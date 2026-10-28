import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../theme';
import { PrimaryButton, TextButton } from './ui';
import { checkForUpdate, downloadAndInstall, UpdateInfo } from '../updater';

// Confere só uma vez por abertura do app
let checkedThisSession = false;
let cached: UpdateInfo | null = null;

export default function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(cached);
  const [progress, setProgress] = useState<number | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (checkedThisSession) return;
    checkedThisSession = true;
    checkForUpdate()
      .then((i) => { cached = i; setInfo(i); })
      .catch(() => {}); // sem internet: tenta de novo na próxima abertura
  }, []);

  if (!info || hidden) return null;

  const start = async () => {
    setProgress(0);
    await downloadAndInstall(info, setProgress);
    setProgress(null);
  };

  return (
    <View style={{ backgroundColor: C.greenSoft, borderRadius: 16, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Ionicons name="arrow-down-circle" size={24} color={C.green} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: C.ink }}>Nova versão disponível ({info.version})</Text>
          <Text style={{ fontSize: 12, color: '#1F4D42', lineHeight: 17 }}>
            {progress === null
              ? 'Toque em Atualizar e depois em Instalar. Seus dados continuam.'
              : `Baixando... ${Math.round(progress * 100)}%`}
          </Text>
        </View>
      </View>
      <PrimaryButton title="Atualizar" onPress={start} loading={progress !== null} />
      {progress === null ? <TextButton title="Agora não" onPress={() => setHidden(true)} /> : null}
    </View>
  );
}
