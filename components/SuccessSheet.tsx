import { Image, Modal, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientButton } from '@/components/GradientButton';
import { shadow } from '@/lib/theme';

type SuccessSheetProps = {
  visible: boolean;
  image: ImageSourcePropType;
  title: string;
  subtitle: string;
  buttonLabel: string;
  onDismiss: () => void;
};

export function SuccessSheet({ visible, image, title, subtitle, buttonLabel, onDismiss }: SuccessSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={{ flex: 1, backgroundColor: 'rgba(12, 18, 38, 0.55)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 36,
            borderTopRightRadius: 36,
            paddingHorizontal: 28,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 16) + 24,
            alignItems: 'center',
            ...shadow.lift,
          }}
        >
          <View style={{ width: 44, height: 5, borderRadius: 999, backgroundColor: '#E2E8F5', marginBottom: 20 }} />

          <View
            style={{
              width: 168,
              height: 168,
              borderRadius: 84,
              backgroundColor: '#FFF6EA',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
              overflow: 'hidden',
            }}
          >
            <Image source={image} style={{ width: 168, height: 168 }} resizeMode="cover" />
          </View>

          <Text style={{ fontSize: 24, fontWeight: '900', color: '#1A1A2E', textAlign: 'center' }}>{title}</Text>
          <Text
            style={{ fontSize: 14, color: '#6B7490', marginTop: 8, marginBottom: 28, textAlign: 'center' }}
          >
            {subtitle}
          </Text>

          <GradientButton label={buttonLabel} onPress={onDismiss} fullWidth variant="dark" />
        </View>
      </View>
    </Modal>
  );
}
