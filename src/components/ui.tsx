// Peças visuais reaproveitadas em todas as telas (como "blocos de Lego").
import React from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleProp, StyleSheet, Switch, Text, TextInput,
  TextInputProps, View, ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../theme';
import { addMonths, monthLabel, YM } from '../lib/dates';

export function Screen(props: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: ('top' | 'bottom')[];
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={props.edges ?? ['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={props.onRefresh ? (
          <RefreshControl refreshing={!!props.refreshing} onRefresh={props.onRefresh} colors={[C.green]} />
        ) : undefined}
      >
        {props.children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
      <ActivityIndicator color={C.green} size="large" />
    </View>
  );
}

export function Title({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={s.title}>{children}</Text>
      {sub ? <Text style={s.sub}>{sub}</Text> : null}
    </View>
  );
}

export function H2({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 }}>
      <Text style={s.h2}>{children}</Text>
      {right}
    </View>
  );
}

export function LinkText({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="link">
      <Text style={{ color: C.green, fontWeight: '700', fontSize: 13 }}>{title}</Text>
    </Pressable>
  );
}

export function Card({ children, style, pad = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; pad?: boolean }) {
  return <View style={[s.card, pad && { padding: 16 }, style]}>{children}</View>;
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.seg} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[s.segBtn, on && s.segOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text style={[s.segTxt, on && { color: C.ink, fontWeight: '800' }]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, active, onPress, dashed, color }: {
  label: string; active?: boolean; onPress?: () => void; dashed?: boolean; color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[
        s.chip,
        dashed && { borderStyle: 'dashed', borderColor: C.warn, backgroundColor: C.warnSoft },
        active && { backgroundColor: C.ink, borderColor: C.ink },
      ]}
    >
      {color ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} /> : null}
      <Text style={[s.chipTxt, active && { color: '#fff', fontWeight: '800' }, dashed && !active && { color: C.warnDark }]}>{label}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string; hint?: string; optional?: boolean }) {
  const { label, hint, optional, style, ...rest } = props;
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>
        {label}
        {optional ? <Text style={{ fontWeight: '500', color: C.muted }}> (opcional)</Text> : null}
      </Text>
      <TextInput placeholderTextColor={C.faint} style={[s.input, style]} accessibilityLabel={label} {...rest} />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Label({ children, right }: { children: React.ReactNode; right?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Text style={s.label}>{children}</Text>
      {right ? <Text style={s.hint}>{right}</Text> : null}
    </View>
  );
}

export function PrimaryButton({ title, onPress, disabled, loading }: { title: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [s.primary, (disabled || loading) && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>{title}</Text>}
    </Pressable>
  );
}

export function DashedButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={s.dashed}>
      <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>{title}</Text>
    </Pressable>
  );
}

export function TextButton({ title, onPress, color = C.ink2 }: { title: string; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color }}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({ name, onPress, label, filled }: { name: keyof typeof Ionicons.glyphMap; onPress: () => void; label: string; filled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[s.iconBtn, filled && { backgroundColor: C.green, borderColor: C.green }]}
    >
      <Ionicons name={name} size={20} color={filled ? '#fff' : C.ink} />
    </Pressable>
  );
}

export function MonthNav({ ym, onChange }: { ym: YM; onChange: (ym: YM) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <IconButton name="chevron-back" label="Mês anterior" onPress={() => onChange(addMonths(ym, -1))} />
      <Text style={{ fontSize: 20, fontWeight: '800', color: C.ink }}>{monthLabel(ym)}</Text>
      <IconButton name="chevron-forward" label="Próximo mês" onPress={() => onChange(addMonths(ym, 1))} />
    </View>
  );
}

/** Converte número em largura percentual aceita pelo React Native */
export function pw(n: number): `${number}%` {
  const v = Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));
  return `${v}%` as `${number}%`;
}

export function Bar({ pct, color, height = 6 }: { pct: number; color: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: C.track, overflow: 'hidden' }}>
      <View style={{ height, width: pw(pct), backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

export function Dot({ color, size = 10 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

export function Pill({ text, tone }: { text: string; tone: 'ok' | 'warn' | 'neutral' | 'danger' }) {
  const map = {
    ok: [C.greenSoft, C.greenDark],
    warn: [C.warnSoft, C.warnDark],
    neutral: [C.track, C.ink2],
    danger: ['#FDE8E6', C.danger],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start' }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: '800' }}>{text}</Text>
    </View>
  );
}

export function SwitchRow({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: C.ink }}>{label}</Text>
        {sub ? <Text style={s.hint}>{sub}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.green, false: C.dashed }} thumbColor="#fff" />
    </Pressable>
  );
}

export function Notice({ title, text, tone = 'warn', onPress }: { title: string; text?: string; tone?: 'warn' | 'ok' | 'info'; onPress?: () => void }) {
  const bg = tone === 'warn' ? C.warnSoft : tone === 'ok' ? C.greenSoft : C.track;
  const fg = tone === 'warn' ? '#6B4A1E' : tone === 'ok' ? '#1F4D42' : C.ink2;
  const icon = tone === 'warn' ? 'alert-circle-outline' : tone === 'ok' ? 'checkmark-circle-outline' : 'information-circle-outline';
  const color = tone === 'warn' ? C.warn : tone === 'ok' ? C.green : C.muted;
  const body = (
    <View style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, backgroundColor: bg }}>
      <Ionicons name={icon} size={22} color={color} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: C.ink }}>{title}</Text>
        {text ? <Text style={{ fontSize: 12, color: fg, lineHeight: 17 }}>{text}</Text> : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={fg} /> : null}
    </View>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button">{body}</Pressable> : body;
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: C.line, borderRadius: 16, padding: 18 }}>
      <Text style={{ textAlign: 'center', color: C.muted, fontSize: 13, lineHeight: 19 }}>{text}</Text>
    </View>
  );
}

export function RowDivider() {
  return <View style={{ height: 1, backgroundColor: C.lineSoft }} />;
}

export const s = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: C.ink, letterSpacing: -0.3 },
  sub: { fontSize: 13, color: C.muted, lineHeight: 18 },
  h2: { fontSize: 17, fontWeight: '800', color: C.ink },
  card: { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line },
  seg: { flexDirection: 'row', gap: 4, padding: 4, backgroundColor: C.segBg, borderRadius: 14 },
  segBtn: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segOn: { backgroundColor: '#fff', elevation: 1 },
  segTxt: { fontSize: 13, fontWeight: '600', color: C.ink2 },
  chip: {
    minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: '#D6D3C9', backgroundColor: '#fff',
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  chipTxt: { fontSize: 13, fontWeight: '600', color: C.ink },
  label: { fontSize: 14, fontWeight: '800', color: C.ink },
  hint: { fontSize: 12, color: C.muted, lineHeight: 17 },
  input: {
    minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: '#D6D3C9', borderRadius: 14,
    backgroundColor: '#fff', fontSize: 15, color: C.ink,
  },
  primary: { minHeight: 54, borderRadius: 16, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  primaryTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  dashed: {
    minHeight: 52, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.dashed,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.line, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
});
