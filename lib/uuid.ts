// React Native's Hermes engine has no global `crypto.randomUUID()` (that's a
// Web Crypto API global, not available on-device), so we can't rely on it
// like a browser or Node script could. These IDs are just client-generated
// primary keys for DB rows, not security-sensitive secrets, so a
// Math.random()-based v4 UUID is fine — no native module/polyfill needed.
export function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
