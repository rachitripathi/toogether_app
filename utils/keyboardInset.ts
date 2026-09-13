/**
 * Bottom inset for a composer pinned to the bottom of a full-bleed screen while
 * the keyboard is up.
 *
 * Android runs edge-to-edge (mandatory since SDK 54; `edgeToEdgeEnabled=true` in
 * gradle.properties), which means the activity window no longer shrinks for the
 * keyboard even though the manifest still says `windowSoftInputMode="adjustResize"`.
 * The root view stays full-screen and the IME just draws over it, so the composer
 * has to lift itself.
 *
 * How much to lift differs per platform, because the two sides measure differently:
 *
 * - Android: RN reports `endCoordinates.height` as `imeInsets.bottom - systemBars.bottom`
 *   (ReactRootView.checkForKeyboardEvents), i.e. the keyboard *minus* the navigation
 *   bar it overlaps. safe-area-context's bottom inset is that same navigation bar and
 *   deliberately never includes the IME (SafeAreaUtils.getRootWindowInsetsCompatR).
 *   The two are complements, so clearing the keyboard takes keyboardHeight + bottomInset.
 * - iOS: the keyboard frame is already measured from the bottom of the screen, home
 *   indicator included, so keyboardHeight alone clears it.
 *
 * With the keyboard up the system bars / home indicator are covered by the keyboard,
 * so the resting safe-area padding is replaced rather than added on top of it —
 * adding both is what produces a double gap.
 */
export function composerBottomInset({
  os,
  keyboardHeight,
  bottomInset,
  minRestInset = 16,
}: {
  os: string;
  keyboardHeight: number;
  bottomInset: number;
  minRestInset?: number;
}): number {
  if (keyboardHeight <= 0) {
    return Math.max(bottomInset, minRestInset);
  }
  return os === 'android' ? keyboardHeight + bottomInset : keyboardHeight;
}
