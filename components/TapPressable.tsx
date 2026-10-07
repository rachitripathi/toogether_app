import { Pressable, type PressableProps } from 'react-native';
import { useTapWithoutDrag } from '@/hooks/useTapWithoutDrag';

// Pressable whose onPress ignores swipes (see useTapWithoutDrag). Use for large tappable cards
// and rows inside scroll views, where a sideways swipe shouldn't open anything.
export function TapPressable({ onPress, ...props }: Omit<PressableProps, 'onPress' | 'onPressIn'> & { onPress: () => void }) {
  const tap = useTapWithoutDrag(onPress);
  return <Pressable {...props} {...tap} />;
}
