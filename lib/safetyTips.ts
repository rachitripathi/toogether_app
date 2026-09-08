import type { Ionicons } from '@expo/vector-icons';

export type SafetyTip = {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
};

export const SAFETY_TIPS: SafetyTip[] = [
  { icon: 'people-outline', text: 'Always meet in a public place, especially the first time.' },
  { icon: 'person-add-outline', text: "Bring a friend along, or tell someone where you're going." },
  { icon: 'chatbubble-ellipses-outline', text: "Don't share personal info like your home address, ID, or bank details in chat." },
  { icon: 'call-outline', text: 'Keep the conversation in the app until you actually trust the person.' },
  { icon: 'car-outline', text: 'Arrange your own way there and back — never rely on a stranger for a ride.' },
  { icon: 'flag-outline', text: "Trust your gut — if something feels off, leave. It's always okay to back out." },
];
