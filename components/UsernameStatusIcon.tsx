import { ActivityIndicator } from 'react-native';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import type { UsernameAvailability } from '@/hooks/useUsernameAvailability';

export function UsernameStatusIcon({ status }: { status: UsernameAvailability }) {
  const { colors } = useTheme();
  if (status === 'checking') {
    return <ActivityIndicator size="small" color={colors.muted} />;
  }
  if (status === 'available') {
    return <Icon name="checkmark-circle" size={20} color={colors.success} />;
  }
  if (status === 'taken' || status === 'invalid') {
    return <Icon name="close-circle" size={20} color={colors.danger} />;
  }
  return null;
}

export function usernameStatusMessage(status: UsernameAvailability, normalized: string): { error?: string; success?: string } {
  if (status === 'taken') {
    return { error: 'That username is already taken.' };
  }
  if (status === 'invalid') {
    return normalized.length > 0
      ? { error: '3-20 characters: letters, numbers, and underscores only.' }
      : {};
  }
  if (status === 'available') {
    return { success: 'Username available' };
  }
  return {};
}
