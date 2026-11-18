import { useState, useRef, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { FormField } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import { isOnboardingDone } from '../store/home';
import { MOCK_LOGIN_FAIL_EMAIL, MOCK_TAKEN_EMAIL } from '../mock/failures';
import { authenticate } from '../services/api';
import { USE_SERVER } from '../services/config';
import { Check } from 'lucide-react-native';
import { useKeyboardInset } from '../components/useKeyboardInset';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ───────── 로그인 ───────── */
export function LoginScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Login'>) {
  const insets = useSafeAreaInsets();
  const loginScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  // 안드로이드: 키보드가 비밀번호 칸을 가리지 않게
  const keyboard = useKeyboardInset(loginScroll);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = EMAIL_RE.test(email) && password.length > 0;
  const login = async () => {
    if (loading) return;
    if (USE_SERVER) {
      setLoading(true);
      try {
        await authenticate('/auth/login', { email: email.trim(), password });
      } catch (e) {
        // 401 INVALID_CREDENTIALS: 이메일과 비밀번호 중 무엇이 틀렸는지는 알려주지 않아요 (명세서)
        setLoginError(e instanceof Error ? e.message : '이메일 또는 비밀번호가 맞지 않아요');
        return;
      } finally {
        setLoading(false);
      }
    } else if (email.trim().toLowerCase() === MOCK_LOGIN_FAIL_EMAIL) {
      setLoginError('이메일 또는 비밀번호가 맞지 않아요');
      return;
    }
    // 처음 세팅을 안 마쳤으면 처음 세팅부터 (서버 onboarding.done)
    navigation.reset({ index: 0, routes: [{ name: isOnboardingDone() ? 'Tabs' : 'OnboardingPhoto' }] });
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top, paddingBottom: keyboard || insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView ref={loginScroll} contentContainerStyle={styles.loginContent} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.logo}>MOA</Text>
          <Text style={styles.tagline}>{'흩어진 스크린샷을\n나의 실천으로 모아요.'}</Text>
        </View>

        <View style={{ gap: 16 }}>
          <FormField
            label="이메일"
            placeholder="moa@example.com"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setLoginError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
          />
          <FormField
            label="비밀번호"
            placeholder="비밀번호 입력"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setLoginError(null);
            }}
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
            onSubmitEditing={canSubmit ? login : undefined}
          />
          {loginError && (
            <Text style={styles.formError} accessibilityRole="alert">
              {loginError}
            </Text>
          )}
        </View>

        <View style={{ gap: 12 }}>
          <Button label={loading ? '로그인 중...' : '로그인'} onPress={login} disabled={!canSubmit || loading} />
          <Button label="회원가입" variant="secondary" onPress={() => navigation.navigate('SignupTerms')} />
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
  /** 409 EMAIL_ALREADY_EXISTS */
  const [takenEmail, setTakenEmail] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailError =
    email && !EMAIL_RE.test(email)
      ? '이메일 형식을 확인해 주세요.'
      : takenEmail && email === takenEmail
        ? '이미 가입된 이메일이에요. 로그인해 주세요.'
        : undefined;
  const nicknameError =
    nickname && (nickname.trim().length < 2 || nickname.length > 12) ? '2~12자로 입력해 주세요.' : undefined;
  const passwordError = password && password.length < 8 ? '8자 이상 입력해 주세요.' : undefined;
  const confirmError = confirm && confirm !== password ? '비밀번호가 일치하지 않아요.' : undefined;

  const canSubmit =
    !!email && !!nickname && !!password && !!confirm && !emailError && !nicknameError && !passwordError && !confirmError;

  const signup = async () => {
    if (loading) return;
    setSignupError(null);
    if (USE_SERVER) {
      setLoading(true);
      try {
        await authenticate('/auth/signup', { email: email.trim(), nickname: nickname.trim(), password });
      } catch (e) {
        const message = e instanceof Error ? e.message : '가입하지 못했어요. 다시 시도해 주세요.';
        if (message.includes('이미')) setTakenEmail(email);
        else setSignupError(message);
        return;
      } finally {
        setLoading(false);
      }
    } else if (email.trim().toLowerCase() === MOCK_TAKEN_EMAIL) {
      setTakenEmail(email);
      return;
    }
    // 새로 가입하면 항상 처음 세팅부터
    navigation.reset({ index: 0, routes: [{ name: 'OnboardingPhoto' }] });
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
      {signupError && (
        <Text style={styles.formError} accessibilityRole="alert">
          {signupError}
        </Text>
      )}
      <Pressable onPress={() => navigation.popTo('Login')} hitSlop={8}>
        <Text style={styles.switchText}>
          이미 계정이 있나요? <Text style={{ includeFontPadding: false, fontFamily: fonts.bold, color: colors.primary }}>로그인</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

/* ───────── 약관·개인정보 동의 (회원가입 첫 단계) ───────── */

type TermKind = 'service' | 'privacy' | 'photo' | 'location';
const TERMS: { kind: TermKind; label: string; required: boolean }[] = [
  { kind: 'service', label: '서비스 이용약관', required: true },
  { kind: 'privacy', label: '개인정보 수집·이용', required: true },
  { kind: 'photo', label: '사진 분석 (실천으로 나눈 사진만 분석 후 바로 삭제)', required: true },
  { kind: 'location', label: '위치정보 이용 (저장한 장소 근처 알림)', required: false },
];

export function SignupTermsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'SignupTerms'>) {
  const [agreed, setAgreed] = useState<Record<TermKind, boolean>>({ service: false, privacy: false, photo: false, location: false });
  const all = TERMS.every((t) => agreed[t.kind]);
  const requiredDone = TERMS.filter((t) => t.required).every((t) => agreed[t.kind]);
  const toggleAll = () => setAgreed({ service: !all, privacy: !all, photo: !all, location: !all });

  return (
    <Screen
      title="회원가입"
      onBack={navigation.goBack}
      contentStyle={{ gap: 20 }}
      footer={
        // TODO(백엔드 확인): 동의 여부(특히 위치정보 선택 동의)를 가입 요청에 함께 보낼지
        <Button label="동의하고 계속하기" onPress={() => navigation.navigate('Signup')} disabled={!requiredDone} />
      }
    >
      <Text style={styles.headline}>{'모아를 쓰려면\n아래 내용에 동의해 주세요'}</Text>

      <Pressable
        onPress={toggleAll}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: all }}
        style={[styles.allRow, all && styles.allRowOn]}
      >
        <CheckBox on={all} />
        <Text style={styles.allText}>모두 동의해요</Text>
      </Pressable>

      <View style={{ gap: 4 }}>
        {TERMS.map((t) => (
          <View key={t.kind} style={styles.termRow}>
            <Pressable
              onPress={() => setAgreed((a) => ({ ...a, [t.kind]: !a[t.kind] }))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed[t.kind] }}
              accessibilityLabel={`(${t.required ? '필수' : '선택'}) ${t.label}`}
              style={styles.termCheck}
            >
              <CheckBox on={agreed[t.kind]} small />
              <Text style={styles.termText}>
                <Text style={{ color: t.required ? colors.primary : colors.textSub, includeFontPadding: false, fontFamily: fonts.medium }}>
                  {t.required ? '(필수) ' : '(선택) '}
                </Text>
                {t.label}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>

      <Text style={styles.switchText}>선택 항목은 동의하지 않아도 가입할 수 있어요.</Text>
    </Screen>
  );
}

function CheckBox({ on, small }: { on: boolean; small?: boolean }) {
  const size = small ? 20 : 24;
  return (
    <View
      style={[
        styles.checkBox,
        { width: size, height: size, borderRadius: size / 2 },
        on && { backgroundColor: colors.primary, borderColor: colors.primary },
      ]}
    >
      {on && <Check size={small ? 12 : 14} color="#fff" strokeWidth={3} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  loginContent: { flexGrow: 1, justifyContent: 'center', padding: 20, gap: 32 },
  hero: { gap: 12 },
  logo: { includeFontPadding: false, fontFamily: fonts.serif, fontSize: 40, lineHeight: 48, color: colors.primary },
  tagline: { includeFontPadding: false, fontFamily: fonts.serif, fontSize: 22, lineHeight: 33, color: colors.text },
  headline: { includeFontPadding: false, fontFamily: fonts.serif, fontSize: 26, lineHeight: 39, color: colors.text },
  switchText: { includeFontPadding: false, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSub },
  formError: { includeFontPadding: false, fontFamily: fonts.medium, fontSize: 13, color: colors.error },

  allRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  allRowOn: { borderColor: colors.primary },
  allText: { includeFontPadding: false, fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  termRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  termCheck: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  termText: { flex: 1, includeFontPadding: false, fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  checkBox: { borderWidth: 1.8, borderColor: '#c4c2bb', alignItems: 'center', justifyContent: 'center' },
});
