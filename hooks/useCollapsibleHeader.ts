import { useRef } from 'react';
import { Animated } from 'react-native';

const COLLAPSE_OFFSET = 80;

export function useCollapsibleHeader() {
  const scrollY = useRef(new Animated.Value(0)).current;

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  );

  const compactOpacity = scrollY.interpolate({
    inputRange: [COLLAPSE_OFFSET - 20, COLLAPSE_OFFSET + 20],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const expandedOpacity = scrollY.interpolate({
    inputRange: [COLLAPSE_OFFSET - 20, COLLAPSE_OFFSET + 20],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return { scrollY, onScroll, compactOpacity, expandedOpacity };
}
