/**
 * How much of the bottom of the screen the keyboard covers (0 when hidden).
 *
 * Android runs edge-to-edge (mandatory since SDK 54; `edgeToEdgeEnabled=true` in
 * gradle.properties), so the window usually no longer shrinks for the keyboard even
 * though the manifest still says `windowSoftInputMode="adjustResize"`, and the IME just
 * draws over the root view. Content that has to clear it lifts itself — but by the
 * measured overlap (hooks/useKeyboardHeight.ts `useKeyboardOverlap`), not by this number
 * directly, so a window that did resize doesn't get lifted twice.
 *
 * The two platforms measure differently:
 *
 * - Android: RN reports `endCoordinates.height` as `imeInsets.bottom - systemBars.bottom`
 *   (ReactRootView.checkForKeyboardEvents), i.e. the keyboard *minus* the navigation
 *   bar it overlaps. safe-area-context's bottom inset is that same navigation bar and
 *   deliberately never includes the IME (SafeAreaUtils.getRootWindowInsetsCompatR).
 *   The two are complements, so the covered height is keyboardHeight + bottomInset.
 * - iOS: the keyboard frame is already measured from the bottom of the screen, home
 *   indicator included, so keyboardHeight alone is the covered height.
 */
export function keyboardCoveredHeight({
  os,
  keyboardHeight,
  bottomInset,
}: {
  os: string;
  keyboardHeight: number;
  bottomInset: number;
}): number {
  if (keyboardHeight <= 0) {
    return 0;
  }
  return os === 'android' ? keyboardHeight + bottomInset : keyboardHeight;
}
