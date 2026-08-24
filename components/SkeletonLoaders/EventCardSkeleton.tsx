// components/EventCardSkeleton.tsx
import { View } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";
import { SkeletonBox } from "./SkeletonBox";

export function EventCardSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <SkeletonBox width={44} height={44} borderRadius={22} />
        <View style={{ marginLeft: 12, gap: 6 }}>
          <SkeletonBox width={60} height={20} borderRadius={10} />
          <SkeletonBox width={120} height={18} borderRadius={6} />
        </View>
      </View>
      <View style={{ gap: 8, marginTop: 12 }}>
        <SkeletonBox width={180} height={14} borderRadius={6} />
        <SkeletonBox width={100} height={14} borderRadius={6} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <SkeletonBox width={40} height={14} borderRadius={6} />
        <SkeletonBox width={80} height={32} borderRadius={16} />
      </View>
    </View>
  );
}
