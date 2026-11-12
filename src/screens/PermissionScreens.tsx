import type { ReactNode } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BellOff, ImageOff, MapPinOff, type LucideIcon } from 'lucide-react-native';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { Caption, Card, EmptyState, Lines, SettingItem, StatusChip } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';

type Props = {
  title: string;
  icon: LucideIcon;
  heading: string;
  lines: string[];
  card: ReactNode;
  note: ReactNode;
  onBack: () => void;
  onLater?: () => void;
};

/** 권한 안내 화면 공통 레이아웃 (사진 / 위치 / 알림) */
function PermissionNotice({ title, icon, heading, lines, card, note, onBack, onLater }: Props) {
  return (
    <Screen
      title={title}
      onBack={onBack}
      contentStyle={{ gap: 16 }}
      footer={
        <View style={{ gap: 8 }}>
          <Button label="시스템 설정 열기" onPress={() => Linking.openSettings()} />
          {onLater && <Button label="나중에" variant="secondary" onPress={onLater} />}
        </View>
      }
    >
      <EmptyState icon={icon} title={heading} lines={lines} />
      {card}
      {note}
    </Screen>
  );
}

type Nav<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

/** S04A 사진 권한 거부 */
export function PhotoPermissionScreen({ navigation }: Nav<'PhotoPermission'>) {
  return (
    <PermissionNotice
      title="사진 선택"
      icon={ImageOff}
      heading="사진 접근이 꺼져 있어요"
      lines={['정리할 스크린샷을 가져오려면', '사진 접근 권한이 필요해요.']}
      onBack={navigation.goBack}
      card={
        <Card tone="warn">
          <Text style={styles.cardTitle}>사진 권한 허용 안 함</Text>
          <Caption>OS 설정에서 사진 접근을 허용한 뒤 다시 선택해 주세요. 휴대폰의 원본은 변경하지 않아요.</Caption>
        </Card>
      }
      note={<Lines lines={['이미지 한 장을 불러오지 못한 경우와 달리,', '현재는 사진 목록에 접근할 수 없어요.']} />}
    />
  );
}

/** S12D 위치 권한 안내 */
export function LocationPermissionScreen({ navigation }: Nav<'LocationPermission'>) {
  return (
    <PermissionNotice
      title="위치 권한 안내"
      icon={MapPinOff}
      heading="장소 근처에서 떠올리기"
      lines={['위치 권한을 허용하면 방문할 장소 근처에서', '실천을 다시 떠올릴 수 있어요.']}
      onBack={navigation.goBack}
      onLater={navigation.goBack}
      card={
        <Card>
          <SettingItem
            label="위치 기반 알림"
            value={false}
            disabled
            description="OS 위치 권한 없음 · 꺼짐 유지"
            warning="권한 없음 · 사용 불가"
          />
        </Card>
      }
      note={<Caption>권한을 허용하기 전에는 이 설정을 켤 수 없어요. 허용 여부는 시스템 설정에서 직접 바꿔주세요.</Caption>}
    />
  );
}

/** S12C 알림 권한 안내 */
export function NotificationPermissionScreen({ navigation }: Nav<'NotificationPermission'>) {
  return (
    <PermissionNotice
      title="알림 권한 안내"
      icon={BellOff}
      heading="필요할 때 다시 알려드려요"
      lines={['알림 권한을 허용하면 대기 중인 실천과', '보류한 날짜를 놓치지 않도록 알려드려요.']}
      onBack={navigation.goBack}
      onLater={navigation.goBack}
      card={
        <Card>
          <StatusChip label="알림 허용 안 함" tone="warn" />
          <Lines lines={['완료·안함은 알림을 중단해요.', '참고 항목은 알림 대상이 아니에요.']} />
        </Card>
      }
      note={<Caption>앱의 알림 주기만 바꿔서는 OS 권한이 켜지지 않아요. 시스템 설정에서 허용해 주세요.</Caption>}
    />
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 21, color: colors.primary },
});
