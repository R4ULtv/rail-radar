import { env } from "@/lib/env";

export function staticAssetUrl(path: `/${string}`): string {
  return `${env.staticUrl}${path}`;
}
