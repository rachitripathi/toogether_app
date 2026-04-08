import { Text, TextInput, View } from 'react-native';
import { colors } from '@/lib/theme';

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  error?: string;
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
}: FormFieldProps) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        keyboardType={keyboardType}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={{
          minHeight: multiline ? 120 : 54,
          borderRadius: 18,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          paddingHorizontal: 16,
          paddingVertical: multiline ? 14 : 0,
          color: colors.text,
          fontSize: 15,
        }}
      />
      {error ? <Text style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}
