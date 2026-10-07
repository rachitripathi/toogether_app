import { useRef } from 'react';
import type { GestureResponderEvent } from 'react-native';

// Max finger travel (px) between press-in and release that still counts as a tap.
const TAP_SLOP = 10;

// Pressable fires onPress on release as long as the finger is still inside the element. A
// vertical ScrollView only takes over vertical drags, so a sideways or diagonal swipe across a
// wide card would otherwise "tap" it. Spread the result onto a Pressable in place of onPress.
export function useTapWithoutDrag(onTap: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onPressIn: (e: GestureResponderEvent) => {
      start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    },
    onPress: (e: GestureResponderEvent) => {
      const origin = start.current;
      start.current = null;
      if (
        origin &&
        Math.hypot(e.nativeEvent.pageX - origin.x, e.nativeEvent.pageY - origin.y) > TAP_SLOP
      ) {
        return;
      }
      onTap();
    },
  };
}
