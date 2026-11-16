import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { FormField } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import { authenticate } from '../services/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ───────── 로그인 ───────── */
export function LoginScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Login'>) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = EMAIL_RE.test(email) && password.length > 0;
  const login = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await authenticate('/auth/login', { email: email.trim(), password });
      navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
    } catch (error) {
      Alert.alert('로그인 실패', error instanceof Error ? error.message : '다시 시도해 주세요.');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.loginContent} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.logo}>MOA</Text>
          <Text style={styles.tagline}>{'흩어진 스크린샷을\n나의 실천으로 모아요.'}</Text>
        </View>

        <View style={{ gap: 16 }}>
          <FormField
            label="이메일"
            placeholder="moa@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
          />
          <FormField
            label="비밀번호"
            placeholder="비밀번호 입력"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
            onSubmitEditing={canSubmit ? login : undefined}
          />
        </View>

        <View style={{ gap: 12 }}>
          <Button label={loading ? '로그인 중...' : '로그인'} onPress={login} disabled={!canSubmit || loading} />
          <Button label="회원가입" variant="secondary" onPress={() => navigation.navigate('Signup')} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ───────── 회원가입 ───────── */
export function SignupScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Signup'>) {
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const emailError = email && !EMAIL_RE.test(email) ? '이메일 형식을 확인해 주세요.' : undefined;
  const nicknameError =
    nickname && (nickname.trim().length < 2 || nickname.length > 12) ? '2~12자로 입력해 주세요.' : undefined;
  const passwordError = password && password.length < 8 ? '8자 이상 입력해 주세요.' : undefined;
  const confirmError = confirm && confirm !== password ? '비밀번호가 일치하지 않아요.' : undefined;

  const canSubmit =
    !!email && !!nickname && !!password && !!confirm && !emailError && !nicknameError && !passwordError && !confirmError;

  const signup = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await authenticate('/auth/signup', { email: email.trim(), nickname: nickname.trim(), password });
      navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
    } catch (error) {
      Alert.alert('회원가입 실패', error instanceof Error ? error.message : '다시 시도해 주세요.');
    } finally { setLoading(false); }
  };

  return (
    <Screen
      title="회원가입"
      onBack={navigation.goBack}
      contentStyle={{ gap: 16 }}
      footer={
        <View style={styles.actions}>
          <Button label="취소" variant="secondary" onPress={navigation.goBack} style={styles.flex} />
          <Button label={loading ? '가입 중...' : '가입하기'} onPress={signup} disabled={!canSubmit || loading} style={styles.flex} />
        </View>
      }
    >
      <Text style={styles.headline}>{'모아와 함께\n시작해 볼까요?'}</Text>
      <FormField
        label="이메일"
        placeholder="moa@example.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        error={emailError}
      />
      <FormField
        label="닉네임"
        placeholder="닉네임 입력"
        value={nickname}
        onChangeText={setNickname}
        maxLength={12}
        error={nicknameError}
      />
      <FormField
        label="비밀번호"
        placeholder="비밀번호 입력"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        error={passwordError}
        hint="8자 이상으로 입력해 주세요."
      />
      <FormField
        label="비밀번호 확인"
        placeholder="비밀번호 다시 입력"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoCapitalize="none"
        error={confirmError}
      />
      <Pressable onPress={navigation.goBack} hitSlop={8}>
        <Text style={styles.switchText}>
          이미 계정이 있나요? <Text style={{ fontFamily: fonts.bold, color: colors.primary }}>로그인</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  loginContent: { flexGrow: 1, justifyContent: 'center', padding: 20, gap: 32 },
  hero: { gap: 12 },
  logo: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 48, color: colors.primary },
  tagline: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 33, color: colors.text },
  headline: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 39, color: colors.text },
  switchText: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSub },
});
