// Peças visuais da aba Carteira.
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Dot, pw } from './ui';
import { C } from '../theme';
import { Slice } from '../lib/portfolio';
import { brl } from '../lib/format';
import { Verdict } from '../lib/indicators';

/** Barra dividida em cores + lista com valor e %. */
export function AllocationCard({ title, slices, hidden }: { title: string; slices: Slice[]; hidden?: boolean }) {
  if (!slices.length) return null;
  return (
    <Card style={{ gap: 12 }}>
      <Text style={{ fontSize: 14, fontWeight: '800', color: C.ink }}>{title}</Text>
      <View style={{ height: 14, borderRadius: 7, overflow: 'hidden', flexDirection: 'row', backgroundColor: C.track }}>
        {slices.map((s) => (
          <View key={s.key} style={{ width: pw(s.pct), backgroundColor: s.color, borderRightWidth: 2, borderRightColor: '#fff' }} />
        ))}
      </View>
      {slices.map((s) => (
        <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Dot color={s.color} />
          <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: C.ink }} numberOfLines={1}>{s.label}</Text>
          <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted, minWidth: 40, textAlign: 'right' }}>{Math.round(s.pct)}%</Text>
          <Text style={{ fontSize: 13, fontWeight: '800', color: C.ink, minWidth: 96, textAlign: 'right' }}>{hidden ? 'R$ ••••' : brl(s.value)}</Text>
        </View>
      ))}
    </Card>
  );
}

/** Quadradinho com um número e uma legenda curta. */
export function StatBox({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' | 'danger' }) {
  const color = tone === 'ok' ? C.green : tone === 'warn' ? C.warn : tone === 'danger' ? C.danger : C.ink;
  return (
    <View style={{ flex: 1, minWidth: 96, backgroundColor: C.bg, borderRadius: 12, padding: 10, gap: 2 }}>
      <Text style={{ fontSize: 11, color: C.muted, fontWeight: '700' }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '800', color }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {sub ? <Text style={{ fontSize: 10, color: C.muted }} numberOfLines={2}>{sub}</Text> : null}
    </View>
  );
}

/** Linha de indicador: nome, valor, selo e explicação que abre ao tocar. */
export function IndicatorRow({ name, value, verdict, explain }: { name: string; value: string; verdict: Verdict; explain: string }) {
  const [open, setOpen] = useState(false);
  const map: Record<Verdict, { bg: string; fg: string; text: string }> = {
    bom: { bg: C.greenSoft, fg: C.greenDark, text: 'bom sinal' },
    neutro: { bg: C.track, fg: C.ink2, text: 'na média' },
    atencao: { bg: C.warnSoft, fg: C.warnDark, text: 'atenção' },
    semdado: { bg: C.track, fg: C.faint, text: 'sem dado' },
  };
  const m = map[verdict];
  return (
    <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" style={{ paddingVertical: 10, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: C.ink }}>{name}</Text>
        <View style={{ backgroundColor: m.bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: m.fg }}>{m.text}</Text>
        </View>
        <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink, minWidth: 70, textAlign: 'right' }}>{value}</Text>
        <Ionicons name={open ? 'chevron-up' : 'information-circle-outline'} size={16} color={C.faint} />
      </View>
      {open ? <Text style={{ fontSize: 12, color: C.ink2, lineHeight: 18 }}>{explain}</Text> : null}
    </Pressable>
  );
}

export function pctText(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${v.toFixed(digits).replace('.', ',')}%`;
}

export function numText(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toFixed(digits).replace('.', ',');
}
