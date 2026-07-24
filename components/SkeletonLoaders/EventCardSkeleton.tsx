// components/EventCardSkeleton.tsx
import { StyleSheet, View } from "react-native";
import { SkeletonBox } from "./SkeletonBox";

export function EventCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
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
      <View style={styles.footer}>
        <SkeletonBox width={40} height={14} borderRadius={6} />
        <SkeletonBox width={80} height={32} borderRadius={16} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
});
