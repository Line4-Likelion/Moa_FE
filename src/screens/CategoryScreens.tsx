import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { FormField, Lines, OptionRow } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { errorMessage } from '../services/api';
import { addCategory, changeCategory, useCapture, useCategories } from '../store/practices';
import { colors, fonts } from '../theme';

function Actions({
  onCancel,
  onSave,
  saveDisabled,
}: {
  onCancel: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
}) {
  return (
    <View style={styles.actions}>
      <Button label="취소" variant="secondary" onPress={onCancel} style={styles.flex} />
      <Button label="저장" onPress={onSave} disabled={saveDisabled} style={styles.flex} />
    </View>
  );
}

/** 11 / 11B 카테고리 추가 (입력 전 · 입력 완료) */
export function CategoryAddScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'CategoryAdd'>) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const canSave = name.trim().length > 0;

  return (
    <Screen
      title="카테고리 추가"
      onBack={navigation.goBack}
      contentStyle={{ gap: 16 }}
      footer={
        <Actions
          onCancel={navigation.goBack}
          onSave={async () => {
            if (saving) return;
            setSaving(true);
            try {
              if (await addCategory(name)) navigation.goBack();
              else setError('이미 있는 카테고리예요');
            } catch (e) {
              setError(errorMessage(e, '카테고리를 추가하지 못했어요'));
            } finally {
              setSaving(false);
            }
          }}
          saveDisabled={!canSave || saving}
        />
      }
    >
      <Text style={styles.headline}>{'나에게 맞는\n이름으로 정리해요.'}</Text>
      <FormField
        label="카테고리 이름"
        placeholder="카테고리 이름 입력"
        value={name}
        onChangeText={(t) => {
          setName(t);
          setError(undefined);
        }}
        error={error}
        maxLength={20}
        returnKeyType="done"
      />
      <Lines lines={['이름을 입력하면 저장할 수 있어요.', '취소하면 카테고리를 만들지 않아요.']} />
    </Screen>
  );
}

/** 12 카테고리 변경 */
export function CategoryChangeScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'CategoryChange'>) {
  const categories = useCategories();
  const ids = route.params.ids ?? [];
  // 하나만 바꿀 때는 지금 카테고리를 선택된 상태로 보여줘요
  const current = useCapture(ids[0] ?? '')?.category?.name;
  const [selected, setSelected] = useState(ids.length === 1 && current ? current : '');

  return (
    <Screen
      title="카테고리 변경"
      onBack={navigation.goBack}
      footer={
        <Actions
          onCancel={navigation.goBack}
          onSave={() => {
            if (ids.length) changeCategory(ids, selected);
            navigation.goBack();
          }}
          saveDisabled={!selected || (ids.length === 1 && selected === current)}
        />
      }
    >
      <Text style={styles.prompt}>{`${route.params.label}\n어디에 모아둘까요?`}</Text>
      {categories.map((label) => (
        <OptionRow key={label} label={label} selected={selected === label} onPress={() => setSelected(label)} />
      ))}
      <OptionRow label="+ 새 카테고리" selected={false} onPress={() => navigation.navigate('CategoryAdd')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  headline: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 39, color: colors.text },
  prompt: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textSub },
});
