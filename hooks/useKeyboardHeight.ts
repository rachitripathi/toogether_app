import { useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Platform, View, type KeyboardEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { keyboardCoveredHeight } from '@/utils/keyboardInset';

// Current on-screen keyboard height as RN reports it (0 when hidden), straight from Keyboard
// events. iOS uses the will* events so layout moves with the keyboard animation; Android only
// has did*. Note the platforms measure differently: see utils/keyboardInset.ts for turning
// this into the amount of screen actually covered.
export function useKeyboardHeight(onShow?: (event: KeyboardEvent) => void) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const onShowRef = useRef(onShow);
  useEffect(() => {
    onShowRef.current = onShow;
  });

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      onShowRef.current?.(e);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return keyboardHeight;
}

// How far the keyboard actually overlaps the view `ref` is attached to (0 when hidden), for
// content that has to lift itself above it. Measured rather than assumed: whether the OS has
// already shrunk the window for the keyboard varies (Android adjustResize vs edge-to-edge, iOS
// scene setups), and padding by the full keyboard height on top of a resize is what pushes a
// composer up to the middle of the screen or leaves a band of empty scroll under a form.
// Re-measure from the view's onLayout too: a window resize can land after the show event.
// `getTarget` measures something other than `ref` (e.g. a ScrollView's native node).
type Measurable = Pick<View, 'measureInWindow'>;
export function useKeyboardOverlap(onShow?: (event: KeyboardEvent) => void, getTarget?: () => Measurable | null | undefined) {
  const insets = useSafeAreaInsets();
  const ref = useRef<View>(null);
  const coveredRef = useRef(0);
  const [overlap, setOverlap] = useState(0);

  const measure = () => {
    const covered = coveredRef.current;
    const target = getTarget ? getTarget() : ref.current;
    if (!covered || !target) return;
    // Window coordinates start at the top of the screen (edge-to-edge on Android, always on iOS).
    const keyboardTop = Dimensions.get('screen').height - covered;
    target.measureInWindow((_x, y, _w, height) => {
      setOverlap(Math.max(0, Math.round(y + height - keyboardTop)));
    });
  };

  const keyboardHeight = useKeyboardHeight((e) => {
    coveredRef.current = keyboardCoveredHeight({
      os: Platform.OS,
      keyboardHeight: e.endCoordinates.height,
      bottomInset: insets.bottom,
    });
    measure();
    onShow?.(e);
  });

  useEffect(() => {
    if (!keyboardHeight) coveredRef.current = 0;
  }, [keyboardHeight]);

  return { ref, onLayout: measure, keyboardVisible: keyboardHeight > 0, overlap: keyboardHeight > 0 ? overlap : 0 };
}
