import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { GradientButton } from '@/components/GradientButton';
import { useTheme } from '@/providers/ThemeProvider';
import { SAFETY_TIPS } from '@/lib/safetyTips';

type SafetyTipsSheetProps = {
  visible: boolean;
  onClose: () => void;
};

export function SafetyTipsSheet({ visible, onClose }: SafetyTipsSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: 'flex-end',
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 24,
            paddingBottom: Math.max(insets.bottom, 20),
            gap: 18,
          }}
        >
          <View style={{ gap: 8 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: colors.status.info.bg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="shield-checkmark-outline" size={26} color={colors.status.info.text} />
            </View>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>Meeting up safely</Text>
            <Text style={{ color: colors.muted, lineHeight: 20 }}>
              You're about to meet someone new in person — a few quick reminders to keep it fun and safe.
            </Text>
          </View>

          <View style={{ gap: 12 }}>
            {SAFETY_TIPS.map((tip) => (
              <View key={tip.text} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                  }}
                >
                  <Icon name={tip.icon} size={15} color={colors.primary} />
                </View>
                <Text style={{ flex: 1, color: colors.text, lineHeight: 21 }}>{tip.text}</Text>
              </View>
            ))}
          </View>

          <GradientButton label="Got it" onPress={onClose} fullWidth />
        </View>
      </View>
    </Modal>
  );
}
