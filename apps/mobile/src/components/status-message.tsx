import { Button } from "heroui-native/button";
import { useThemeColor } from "heroui-native/hooks";
import ArrowUpRight from "lucide-react-native/icons/arrow-up-right";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import type { ComponentType } from "react";
import { Linking, Text, View, type LayoutChangeEvent } from "react-native";
import { serviceStatusUrl } from "@/lib/links";

/**
 * A centered icon, title and description shown in place of content that is empty or couldn't
 * be loaded, with a Try again button under it when there's something to retry, and a link to
 * the service status page when the failure may be a train data provider's.
 */
export function StatusMessage({
  icon: Icon,
  title,
  description,
  onRetry,
  showServiceStatus = false,
  className = "",
  onLayout,
}: {
  icon: ComponentType<{ size?: number; color?: string }>;
  title: string;
  description: string;
  onRetry?: () => void;
  showServiceStatus?: boolean;
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
      {onRetry || showServiceStatus ? (
        <View className="mt-2 flex-row flex-wrap justify-center gap-2">
          {onRetry ? (
            <Button size="sm" variant="tertiary" onPress={onRetry}>
              <RefreshCw size={16} color={foregroundColor} />
              <Button.Label>Try again</Button.Label>
            </Button>
          ) : null}
          {showServiceStatus ? (
            <Button
              size="sm"
              variant="ghost"
              accessibilityRole="link"
              accessibilityHint="Opens the service status page in your browser"
              onPress={() => void Linking.openURL(serviceStatusUrl)}
            >
              <Button.Label>Service status</Button.Label>
              <ArrowUpRight size={16} color={foregroundColor} />
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
