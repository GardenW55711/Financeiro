// Guia: os principais métodos para analisar investimentos, em linguagem simples.
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Chip, Screen } from '../components/ui';
import { C } from '../theme';
import { RootStackParamList } from '../navigation';
import { DISCLAIMER, GUIDE } from '../content/guide';

const SHORT: Record<string, string> = {
  base: 'Básico', rf: 'Renda fixa', acoes: 'Indicadores', metodos: 'Métodos', fii: 'FIIs', fundos: 'Fundos e ETFs', ir: 'Imposto',
};

export default function GuideScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Guia'>>();
  const [section, setSection] = useState(route.params?.section ?? GUIDE[0].id);
  const [open, setOpen] = useState<number | null>(0);
  const sec = GUIDE.find((g) => g.id === section) ?? GUIDE[0];

  return (
    <Screen edges={['bottom']}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {GUIDE.map((g) => (
          <Chip key={g.id} label={SHORT[g.id] ?? g.title} active={g.id === section} onPress={() => { setSection(g.id); setOpen(0); }} />
        ))}
      </View>

      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name={sec.icon as any} size={24} color={C.green} />
          <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: C.ink }}>{sec.title}</Text>
        </View>
        <Text style={{ fontSize: 14, color: C.ink2, lineHeight: 21 }}>{sec.intro}</Text>
      </View>

      {sec.topics.map((t, i) => {
        const isOpen = open === i;
        return (
          <Card key={t.title} pad={false}>
            <Pressable onPress={() => setOpen(isOpen ? null : i)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 }}>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: C.ink }}>{t.title}</Text>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={C.faint} />
            </Pressable>
            {isOpen ? (
              <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}>
                <Text style={{ fontSize: 14, color: C.ink2, lineHeight: 21 }}>{t.body}</Text>
                {t.formula ? (
                  <View style={{ backgroundColor: C.greenSoft, borderRadius: 12, padding: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: C.greenDark, marginBottom: 2 }}>COMO CALCULA</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>{t.formula}</Text>
                  </View>
                ) : null}
                {t.reference ? (
                  <View style={{ backgroundColor: C.track, borderRadius: 12, padding: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: C.ink2, marginBottom: 2 }}>REFERÊNCIA COMUM</Text>
                    <Text style={{ fontSize: 13, color: C.ink, lineHeight: 19 }}>{t.reference}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </Card>
        );
      })}

      <Text style={{ fontSize: 11, color: C.faint, lineHeight: 16 }}>{DISCLAIMER}</Text>
    </Screen>
  );
}
