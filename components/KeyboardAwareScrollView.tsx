import { useEffect, useRef } from 'react';
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  type ScrollViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardOverlap } from '@/hooks/useKeyboardHeight';
import { keyboardCoveredHeight } from '@/utils/keyboardInset';

// Space kept between the focused field and the keyboard / top edge.
const REVEAL_MARGIN = 24;

/**
 * Drop-in ScrollView for forms: while the keyboard is up, the focused field is scrolled into
 * view above it and the content gets enough extra bottom room to scroll the last field clear.
 *
 * - iOS: the native `automaticallyAdjustKeyboardInsets` already does exactly this.
 * - Android: runs edge-to-edge (see utils/keyboardInset.ts), so the window usually doesn't shrink
 *   for the keyboard and nothing scrolls on its own; KeyboardAvoidingView doesn't help either,
 *   because the keyboard's reported screenY doesn't match where it actually sits. So this pads
 *   the content by however much of the ScrollView the keyboard really overlaps (measured, so a
 *   window that did resize doesn't get a second keyboard's worth of empty space under the
 *   form) and scrolls the focused input (found through
 *   TextInput.State) into the visible part itself, on keyboard show and on every tap while the
 *   keyboard is up (moving between fields doesn't fire another keyboard event).
 */
export function KeyboardAwareScrollView({
  contentContainerStyle,
  onScroll,
  onTouchEnd,
  keyboardShouldPersistTaps = 'handled',
  padForKeyboard = true,
  ...props
}: ScrollViewProps & {
  // false when the container already moves itself above the keyboard (e.g. a lifted bottom
  // sheet) and only the scroll-into-view part is wanted.
  padForKeyboard?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const offsetY = useRef(0);
  const coveredRef = useRef(0);

  const revealFocusedInput = () => {
    const covered = coveredRef.current;
    const input = TextInput.State.currentlyFocusedInput();
    const scroll = scrollRef.current;
    const scrollNode = scroll?.getNativeScrollRef();
    if (!covered || !input || !scroll || !scrollNode) return;

    scrollNode.measureInWindow((_sx, scrollTop, _sw, scrollHeight) => {
      input.measureInWindow((_ix, inputTop, _iw, inputHeight) => {
        const visibleTop = scrollTop + REVEAL_MARGIN;
        // Edge-to-edge: window coordinates start at the top of the screen.
        const visibleBottom = Math.min(scrollTop + scrollHeight, Dimensions.get('screen').height - covered) - REVEAL_MARGIN;
        let delta = 0;
        if (inputTop + inputHeight > visibleBottom) {
          // Bring the bottom into view, but never push the top of a tall field off screen.
          delta = Math.min(inputTop + inputHeight - visibleBottom, inputTop - visibleTop);
        } else if (inputTop < visibleTop) {
          delta = inputTop - visibleTop;
        }
        if (delta > 1 || delta < -1) {
          scroll.scrollTo({ y: Math.max(0, offsetY.current + delta), animated: true });
        }
      });
    });
  };

  const { onLayout: onKeyboardOverlapLayout, keyboardVisible, overlap: keyboardOverlap } = useKeyboardOverlap(
    (e) => {
      if (Platform.OS !== 'android') return;
      coveredRef.current = keyboardCoveredHeight({ os: Platform.OS, keyboardHeight: e.endCoordinates.height, bottomInset: insets.bottom });
      // After the extra bottom padding below has rendered, so there's room to scroll into.
      setTimeout(revealFocusedInput, 80);
    },
    () => scrollRef.current?.getNativeScrollRef()
  );
  useEffect(() => {
    if (!keyboardVisible) coveredRef.current = 0;
  }, [keyboardVisible]);

  if (Platform.OS !== 'android') {
    return (
      <ScrollView
        {...props}
        contentContainerStyle={contentContainerStyle}
        onScroll={onScroll}
        onTouchEnd={onTouchEnd}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        automaticallyAdjustKeyboardInsets
      />
    );
  }

  const flat = StyleSheet.flatten(contentContainerStyle) ?? {};
  const restingPaddingBottom = Number(flat.paddingBottom ?? flat.paddingVertical ?? flat.padding ?? 0);

  return (
    <ScrollView
      {...props}
      ref={scrollRef}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      contentContainerStyle={[
        contentContainerStyle,
        keyboardOverlap && padForKeyboard ? { paddingBottom: restingPaddingBottom + keyboardOverlap } : null,
      ]}
      onLayout={(e) => {
        onKeyboardOverlapLayout();
        props.onLayout?.(e);
      }}
      scrollEventThrottle={props.scrollEventThrottle ?? 16}
      onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
        offsetY.current = e.nativeEvent.contentOffset.y;
        onScroll?.(e);
      }}
      onTouchEnd={(e) => {
        if (coveredRef.current) setTimeout(revealFocusedInput, 120);
        onTouchEnd?.(e);
      }}
    />
  );
}
