import { useEffect, useState, type RefObject } from 'react';
import { Keyboard, Platform, TextInput } from 'react-native';

/**
 * 안드로이드 키보드가 입력칸을 가리지 않게
 *
 * 이 React Native 버전은 안드로이드에서 화면이 키보드 아래까지 그려져서(edge-to-edge),
 * 키보드가 올라와도 화면이 줄어들지 않아요. 그래서
 * 1) 키보드 높이만큼 아래 여백을 돌려주고
 * 2) 지금 입력 중인 칸이 보이도록 스크롤을 올려요.
 * 아이폰은 기존 KeyboardAvoidingView 가 처리해서 0 을 돌려줘요.
 */
export function useKeyboardInset(scrollRef?: RefObject<unknown>) {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setHeight(e.endCoordinates.height);
      // 여백이 반영된 다음 입력 칸 위치로 스크롤
      setTimeout(() => {
        const scroll = scrollRef?.current as unknown as {
          getInnerViewRef?: () => unknown;
          scrollTo: (o: { y: number; animated: boolean }) => void;
        } | null;
        const input = TextInput.State.currentlyFocusedInput?.() as unknown as {
          measureLayout?: (rel: unknown, ok: (x: number, y: number) => void, fail: () => void) => void;
        } | null;
        const inner = scroll?.getInnerViewRef?.();
        if (!scroll || !input?.measureLayout || !inner) return;
        input.measureLayout(
          inner,
          (_x, y) => scroll.scrollTo({ y: Math.max(0, y - 120), animated: true }),
          () => {},
        );
      }, 80);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [scrollRef]);

  return height;
}
