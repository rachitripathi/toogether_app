// components/EventDetailSkeleton.tsx
import { View } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";
import { SkeletonBox } from "./SkeletonBox";

export function EventDetailSkeleton() {
  const { colors } = useTheme();
  const cardStyle = { backgroundColor: colors.card, borderRadius: 16, padding: 16, margin: 12, gap: 4 };

  return (
    <View>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", padding: 20, backgroundColor: colors.lavender }}>
        <SkeletonBox width={52} height={52} borderRadius={26} />
        <View style={{ marginLeft: 12, gap: 8 }}>
          <SkeletonBox width={70} height={22} borderRadius={10} />
          <SkeletonBox width={140} height={24} borderRadius={6} />
        </View>
      </View>

      {/* Info card */}
      <View style={cardStyle}>
        <SkeletonBox width={"90%"} height={16} borderRadius={6} />
        <SkeletonBox
          width={100}
          height={16}
          borderRadius={6}
          style={{ marginTop: 10 }}
        />
      </View>

      {/* About card */}
      <View style={cardStyle}>
        <SkeletonBox width={60} height={18} borderRadius={6} />
        <SkeletonBox
          width={"95%"}
          height={14}
          borderRadius={6}
          style={{ marginTop: 10 }}
        />
        <SkeletonBox
          width={"80%"}
          height={14}
          borderRadius={6}
          style={{ marginTop: 6 }}
        />
      </View>

      {/* Join requests card */}
      <View style={cardStyle}>
        <SkeletonBox width={120} height={18} borderRadius={6} />
        <SkeletonBox
          width={"70%"}
          height={14}
          borderRadius={6}
          style={{ marginTop: 10 }}
        />
      </View>
    </View>
  );
}
