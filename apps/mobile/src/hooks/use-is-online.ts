import { useNetworkState } from "expo-network";

/**
 * False once the device reports it has no connection. Requests still go out while offline, since
 * the report can lag behind; this only picks the message to show and retries on reconnecting.
 */
export function useIsOnline() {
  const { isConnected, isInternetReachable } = useNetworkState();
  return isConnected !== false && isInternetReachable !== false;
}
