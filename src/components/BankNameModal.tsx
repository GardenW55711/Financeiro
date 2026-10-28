// Janelinha para trocar o nome do banco de uma conta (ex.: "MeuPluggy" → "Itaú").
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { C } from '../theme';
import { PrimaryButton, TextButton } from './ui';
import { Account, accountLabel, setAccountBankName } from '../db';

const SUGESTOES = ['Itaú', 'Nubank', 'XP', 'Inter', 'Bradesco', 'Santander', 'Caixa', 'Banco do Brasil', 'C6 Bank', 'BTG Pactual', 'Mercado Pago', 'PicPay'];

export default function BankNameModal({ account, onClose, onSaved }: {
  account: Account | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  useEffect(() => { setName(account?.bank_name ?? ''); }, [account]);
  if (!account) return null;

  const save = async (value: string | null) => {
    await setAccountBankName(account.id, value);
    onSaved();
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 20 }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.card, borderRadius: 20, padding: 18, gap: 12 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: C.ink }}>Nome do banco</Text>
            <Text style={{ fontSize: 12, color: C.muted }}>{account.name} · {accountLabel(account)}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex.: Itaú"
              autoFocus
              style={{ borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: C.ink }}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SUGESTOES.map((s) => (
                <Pressable key={s} onPress={() => setName(s)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: name === s ? C.greenSoft : C.track }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: name === s ? C.green : C.ink2 }}>{s}</Text>
                </Pressable>
              ))}
            </View>
            <PrimaryButton title="Salvar" onPress={() => save(name)} disabled={!name.trim()} />
            {account.custom_bank_name ? <TextButton title="Voltar ao nome automático" onPress={() => save(null)} /> : null}
            <TextButton title="Cancelar" onPress={onClose} />
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
