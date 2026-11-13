import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronRight } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { Caption, Card } from '../components/ui';
import { colors, fonts } from '../theme';

type Item = { label: string; code: string; go: () => void };

/** 개발용 화면 목차. 홈 화면의 MoA 로고를 길게 누르면 열려요. */
export function DevHomeScreen() {
  const nav = useNavigation();

  const items: Item[] = [
    { label: '07A 보관함 · 완료함', code: 'C-12~C-15', go: () => nav.navigate('Tabs', { screen: 'Archive' }) },
    { label: 'S11C 완료함 빈 상태', code: 'C-12~C-15', go: () => nav.navigate('Tabs', { screen: 'Archive', params: { empty: true } }) },
    { label: '11 / 11B 카테고리 추가', code: 'B-02~B-05', go: () => nav.navigate('CategoryAdd') },
    { label: '12 카테고리 변경', code: 'B-04', go: () => nav.navigate('CategoryChange', { label: '연남 소바실' }) },
    { label: '08 마이 · 알림 설정', code: 'D-04~D-07', go: () => nav.navigate('Tabs', { screen: 'My' }) },
    { label: '17 로그아웃 확인', code: 'D-07', go: () => nav.navigate('Tabs', { screen: 'My', params: { logout: true } }) },
    { label: '19 리마인드 주기 · 방해금지', code: 'D-05', go: () => nav.navigate('ReminderSettings') },
    { label: '19B 변경된 설정 저장 상태', code: 'D-05', go: () => nav.navigate('Tabs', { screen: 'My', params: { variant: 'saved' } }) },
    { label: 'S12A 프로필 조회 오류', code: 'D-05~D-07', go: () => nav.navigate('Tabs', { screen: 'My', params: { variant: 'error' } }) },
    { label: 'S12B 설정 저장 실패', code: 'D-05~D-07', go: () => nav.navigate('SettingsSaveFailed') },
    { label: 'S12C 알림 권한 안내', code: 'D-05', go: () => nav.navigate('NotificationPermission') },
    { label: 'S12D 위치 권한 안내', code: 'D-04, D-05', go: () => nav.navigate('LocationPermission') },
    { label: 'S04A 사진 권한 거부', code: 'A-02', go: () => nav.navigate('PhotoPermission') },
  ];

  return (
    <Screen title="MOA 화면 목록" onBack={() => nav.goBack()}>
      <Caption>개발용 목차예요. 홈 화면의 MoA 로고를 길게 누르면 열려요.</Caption>
      <Card style={{ padding: 4, gap: 0 }}>
        {items.map((item, i) => (
          <Pressable
            key={item.label}
            onPress={item.go}
            style={[styles.row, i > 0 && styles.rowBorder]}
            accessibilityRole="button"
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.code}>{item.code}</Text>
            </View>
            <ChevronRight size={18} color={colors.textSub} strokeWidth={1.5} />
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

export function PracticeScreen() {
  return (
    <Screen title="실천함" hasTabBar>
      <Caption>준비 중이에요.</Caption>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  label: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  code: { fontFamily: fonts.regular, fontSize: 11, color: colors.textSub, marginTop: 2 },
});
