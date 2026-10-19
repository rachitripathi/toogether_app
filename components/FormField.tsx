import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/providers/ThemeProvider';

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  error?: string;
  success?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  rightAccessory?: ReactNode;
  // Hard cap on length; also shows a live "used/max" counter under the field.
  maxLength?: number;
};

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  multiline,
  keyboardType,
  error,
  success,
  autoCapitalize,
  rightAccessory,
  maxLength,
}: FormFieldProps) {
  const { colors } = useTheme();
  const [isVisible, setIsVisible] = useState(false);

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{label}</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 18,
          backgroundColor: colors.inset,
          borderWidth: error ? 1 : 0,
          borderColor: colors.danger,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          secureTextEntry={secureTextEntry && !isVisible}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={{
            flex: 1,
            minHeight: multiline ? 120 : 54,
            paddingHorizontal: 16,
            paddingVertical: multiline ? 14 : 0,
            color: colors.text,
            fontSize: 15,
          }}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setIsVisible((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={isVisible ? 'Hide password' : 'Show password'}
            style={{ paddingHorizontal: 14 }}
          >
            <Icon name={isVisible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
          </Pressable>
        ) : rightAccessory ? (
          <View style={{ paddingHorizontal: 14 }}>{rightAccessory}</View>
        ) : null}
      </View>
      {error || success || maxLength ? (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            {error ? <Text style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
            {!error && success ? <Text style={{ color: colors.success, fontSize: 12 }}>{success}</Text> : null}
          </View>
          {maxLength ? (
            <Text style={{ color: value.length >= maxLength ? colors.danger : colors.muted, fontSize: 12, fontWeight: '600' }}>
              {value.length}/{maxLength}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
