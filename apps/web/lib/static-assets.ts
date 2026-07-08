export function staticAssetUrl(path: `/${string}`): string {
  return `${process.env.NEXT_PUBLIC_STATIC_URL?.replace(/\/$/, "")}${path}`;
}
