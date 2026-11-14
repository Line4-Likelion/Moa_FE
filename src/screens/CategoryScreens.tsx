import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { FormField, Lines, OptionRow } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { addCategory } from '../store/practices';
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
  const canSave = name.trim().length > 0;

  return (
    <Screen
      title="카테고리 추가"
      onBack={navigation.goBack}
      contentStyle={{ gap: 16 }}
      footer={
        <Actions
          onCancel={navigation.goBack}
          onSave={() => {
            addCategory(name);
            navigation.goBack();
          }}
          saveDisabled={!canSave}
        />
      }
    >
      <Text style={styles.headline}>{'나에게 맞는\n이름으로 정리해요.'}</Text>
      <FormField
        label="카테고리 이름"
        placeholder="카테고리 이름 입력"
        value={name}
        onChangeText={setName}
        maxLength={20}
        returnKeyType="done"
      />
      <Lines lines={['이름을 입력하면 저장할 수 있어요.', '취소하면 카테고리를 만들지 않아요.']} />
    </Screen>
  );
}

const OPTIONS = ['패션', '맛집', '여행', '레시피', '정보', '미분류'];

/** 12 카테고리 변경 */
export function CategoryChangeScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'CategoryChange'>) {
  const [selected, setSelected] = useState('맛집');

  return (
    <Screen
      title="카테고리 변경"
      onBack={navigation.goBack}
      footer={<Actions onCancel={navigation.goBack} onSave={navigation.goBack} />}
    >
      <Text style={styles.prompt}>{`${route.params.label}\n어디에 모아둘까요?`}</Text>
      {OPTIONS.map((label) => (
        <OptionRow key={label} label={label} selected={selected === label} onPress={() => setSelected(label)} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  headline: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 39, color: colors.text },
  prompt: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textSub },
});
