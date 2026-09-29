import { Button } from "heroui-native/button";
import { useThemeColor } from "heroui-native/hooks";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import type { ComponentType } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";

/**
 * A centered icon, title and description shown in place of content that is empty or couldn't
 * be loaded, with a Try again button under it when there's something to retry.
 */
export function StatusMessage({
  icon: Icon,
  title,
  description,
  onRetry,
  className = "",
  onLayout,
}: {
  icon: ComponentType<{ size?: number; color?: string }>;
  title: string;
  description: string;
  onRetry?: () => void;
  className?: string;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const [foregroundColor, mutedColor] = useThemeColor(["default-foreground", "muted"]);

  return (
    <View className={`items-center gap-2 px-4 py-4 ${className}`} onLayout={onLayout}>
      <Icon size={20} color={mutedColor} />
      <View className="items-center gap-0.5">
        <Text className="text-center text-sm font-medium text-foreground">{title}</Text>
        <Text className="text-center text-sm text-muted">{description}</Text>
      </View>
      {onRetry ? (
        <Button className="mt-2" size="sm" variant="tertiary" onPress={onRetry}>
          <RefreshCw size={16} color={foregroundColor} />
          <Button.Label>Try again</Button.Label>
        </Button>
      ) : null}
    </View>
  );
}
