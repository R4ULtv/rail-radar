import { CloseButton } from "heroui-native/close-button";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

/** Every sheet's title, on the left with the close button across from it. */
export function SheetHeader({
  title,
  titleLines,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  /** Lines the title can wrap to; unlimited by default. */
  titleLines?: number;
  closeLabel: string;
  onClose: () => void;
  /** Shown below the title, e.g. a subtitle. */
  children?: ReactNode;
}) {
  return (
    <View className="flex-row items-start gap-3">
      <View style={styles.title}>
        <Text
          accessibilityRole="header"
          className="text-xl font-semibold text-foreground"
          numberOfLines={titleLines}
        >
          {title}
        </Text>
        {children}
      </View>
      <CloseButton accessibilityLabel={closeLabel} onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { flex: 1, minWidth: 0 },
});
