import { DEV_TOOLS_ENABLED } from './devTools';

export type DevAppMode = 'free' | 'paid' | 'limit-hit' | 'new-user';
export type AppVersion = 'free' | 'paid';

// Single switch for branching the app build.
// Set APP_VERSION to 'paid' when you want monetisation enabled by default.
export const APP_VERSION: AppVersion = 'free';

// Both of these follow the centralized DEV_TOOLS_ENABLED switch (see lib/devTools.ts) —
// don't hardcode them independently, or the login screen's account switcher can end up
// on in a build where dev tools were meant to be off.
export const SHOW_LOGIN_VERSION_SWITCH = DEV_TOOLS_ENABLED;
export const SHOW_PAYWALL_DEMO_MODE = DEV_TOOLS_ENABLED;

export const FREE_JOIN_LIMIT = 5;
export const VERIFIED_JOIN_BONUS = 5;
export const FREE_CREATE_LIMIT = 3;

export const CREDIT_PACKS = [
  { id: 'starter', name: 'Starter', price: 19, credits: 3, helper: 'Best for one more weekend plan.' },
  { id: 'regular', name: 'Regular', price: 49, credits: 10, helper: 'Most useful for active joiners.' },
  { id: 'power', name: 'Power', price: 99, credits: 25, helper: 'For people who keep the calendar alive.' },
] as const;

export type CreditPackId = (typeof CREDIT_PACKS)[number]['id'];

export function isMonetisationEnabled(mode: DevAppMode) {
  return mode === 'paid' || mode === 'limit-hit';
}

export function getDefaultAppMode(): DevAppMode {
  return APP_VERSION === 'paid' ? 'paid' : 'free';
}

export function getSelectableAppModes(): DevAppMode[] {
  if (!SHOW_LOGIN_VERSION_SWITCH) {
    return [];
  }

  return SHOW_PAYWALL_DEMO_MODE ? ['free', 'paid', 'limit-hit', 'new-user'] : ['free', 'paid', 'new-user'];
}
