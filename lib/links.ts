import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

// Public Open Plans pages and the support inbox. Both pages list SUPPORT_EMAIL too.
export const SUPPORT_EMAIL = 'info@openplans.app';
export const PRIVACY_POLICY_URL = 'https://openplans.app/privacy';
export const SUPPORT_URL = 'https://openplans.app/support';
// No terms page on the site yet (openplans.app/terms is a 404). Set this once it exists and the
// auth screen's "By continuing, you agree to…" line adds a Terms of Service link by itself.
export const TERMS_URL: string | null = null;

// In-app browser sheet, so reading the policy doesn't send the user out of the app.
export function openWebPage(url: string) {
  WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => {}));
}

export function emailSupport(subject?: string) {
  const query = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  Linking.openURL(`mailto:${SUPPORT_EMAIL}${query}`).catch(() => {});
}
