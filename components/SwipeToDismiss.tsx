import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, LayoutAnimation, PanResponder, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/providers/ThemeProvider';

// Only claim the gesture once it's clearly sideways, so the surrounding vertical ScrollView
// keeps every vertical or diagonal drag.
const isHorizontalSwipe = (dx: number, dy: number) => Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5;

// A row that can be swiped left or right to remove it. Swiping past ~35% of its width (or
// flicking) slides it out and calls onDismiss; anything less springs back. Plain PanResponder
// rather than react-native-gesture-handler, which isn't set up in this app.
export function SwipeToDismiss({
  onDismiss,
  borderRadius = 20,
  children,
}: {
  onDismiss: () => void;
  borderRadius?: number;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const [translateX] = useState(() => new Animated.Value(0));
  const width = useRef(0);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  // The refs below are only read inside gesture callbacks, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() => {
    const springBack = () => Animated.spring(translateX, { toValue: 0, useNativeDriver: false }).start();
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => isHorizontalSwipe(g.dx, g.dy),
      onMoveShouldSetPanResponderCapture: (_, g) => isHorizontalSwipe(g.dx, g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => translateX.setValue(g.dx),
      onPanResponderRelease: (_, g) => {
        const passed = Math.abs(g.dx) > width.current * 0.35 || Math.abs(g.vx) > 0.8;
        if (!passed) {
          springBack();
          return;
        }
        const direction = Math.sign(g.dx || g.vx) || 1;
        Animated.timing(translateX, {
          toValue: direction * (width.current + 40),
          duration: 160,
          useNativeDriver: false,
        }).start(() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          onDismissRef.current();
        });
      },
      onPanResponderTerminate: springBack,
    });
  });

  const backgroundOpacity = translateX.interpolate({
    inputRange: [-80, -10, 0, 10, 80],
    outputRange: [1, 0, 0, 0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View onLayout={(e) => (width.current = e.nativeEvent.layout.width)}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius,
          backgroundColor: colors.solid.decline,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 22,
          opacity: backgroundOpacity,
        }}
      >
        {[0, 1].map((side) => (
          <View key={side} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="trash-outline" size={18} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>Remove</Text>
          </View>
        ))}
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX }] }} {...responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}
