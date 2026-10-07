import { Button } from "heroui-native/button";
import { Dialog } from "heroui-native/dialog";
import { useCallback, useState } from "react";
import { View } from "react-native";

export type DialogRequest = {
  title: string;
  message: string;
  /** A red action next to Cancel. Without one, the dialog only has OK. */
  action?: { label: string; onConfirm: () => void };
};

/**
 * Asks with the app's own dialog, on both platforms. The system alert looked out of place on
 * Android, and one dialog keeps the two platforms the same.
 */
export function useAppDialog() {
  // The request outlives `isOpen`, so the text stays while the dialog animates out.
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const show = useCallback((next: DialogRequest) => {
    setRequest(next);
    setIsOpen(true);
  }, []);

  return { show, dialogProps: { request, isOpen, onOpenChange: setIsOpen } };
}

export function AppDialog({
  request,
  isOpen,
  onOpenChange,
  hostName,
}: {
  request: DialogRequest | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /**
   * A portal host inside a React Native modal. The default host is under the modal on Android,
   * so a dialog opened from one would show behind it.
   */
  hostName?: string;
}) {
  if (!request) return null;
  const { title, message, action } = request;
  const close = () => onOpenChange(false);

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal hostName={hostName}>
        {/* Darker than the default, which barely dimmed a dark sheet behind the dialog. */}
        <Dialog.Overlay className="bg-black/50" />
        <Dialog.Content>
          <View className="mb-5 gap-1.5">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Description>{message}</Dialog.Description>
          </View>
          <View className="flex-row gap-3">
            {action ? (
              <>
                <Button className="flex-1" variant="tertiary" onPress={close}>
                  <Button.Label>Cancel</Button.Label>
                </Button>
                <Button
                  className="flex-1"
                  variant="danger"
                  onPress={() => {
                    close();
                    action.onConfirm();
                  }}
                >
                  <Button.Label>{action.label}</Button.Label>
                </Button>
              </>
            ) : (
              <Button className="flex-1" variant="primary" onPress={close}>
                <Button.Label>OK</Button.Label>
              </Button>
            )}
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
