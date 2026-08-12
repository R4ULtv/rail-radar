import { env } from "@/lib/env";

type ImageMetadata = string | { url: string; width?: number; height?: number; alt?: string };

export interface Metadata {
  title?: string | { default: string; template?: string };
  description?: string;
  alternates?: { canonical?: string };
  openGraph?: {
    type?: string;
    url?: string;
    siteName?: string;
    title?: string;
    description?: string;
    images?: ImageMetadata[];
  };
  twitter?: {
    card?: string;
    title?: string;
    description?: string;
    images?: ImageMetadata[];
  };
  robots?: { index?: boolean };
}

function absoluteUrl(value: string | URL): string {
  return new URL(value.toString(), env.siteUrl).toString();
}

function imageUrl(image: ImageMetadata): string {
  return absoluteUrl(typeof image === "string" ? image : image.url);
}

export function metadataToHead(metadata: Metadata) {
  const rawTitle = typeof metadata.title === "string" ? metadata.title : metadata.title?.default;
  const title = rawTitle?.includes("Rail Radar")
    ? rawTitle
    : rawTitle
      ? `${rawTitle} | Rail Radar`
      : undefined;
  const canonical = metadata.alternates?.canonical;
  const openGraph = metadata.openGraph;
  const twitter = metadata.twitter;
  const ogImage = openGraph?.images?.[0];
  const twitterImage = twitter?.images?.[0] ?? ogImage;

  return {
    meta: [
      ...(title ? [{ title }] : []),
      ...(metadata.description ? [{ name: "description", content: metadata.description }] : []),
      ...(metadata.robots?.index === false ? [{ name: "robots", content: "noindex" }] : []),
      ...(openGraph?.type ? [{ property: "og:type", content: openGraph.type }] : []),
      ...(openGraph?.url ? [{ property: "og:url", content: absoluteUrl(openGraph.url) }] : []),
      ...(openGraph?.siteName ? [{ property: "og:site_name", content: openGraph.siteName }] : []),
      ...((openGraph?.title ?? title)
        ? [{ property: "og:title", content: openGraph?.title ?? title! }]
        : []),
      ...((openGraph?.description ?? metadata.description)
        ? [
            {
              property: "og:description",
              content: openGraph?.description ?? metadata.description!,
            },
          ]
        : []),
      ...(ogImage ? [{ property: "og:image", content: imageUrl(ogImage) }] : []),
      ...(twitter?.card ? [{ name: "twitter:card", content: twitter.card }] : []),
      ...((twitter?.title ?? openGraph?.title ?? title)
        ? [{ name: "twitter:title", content: twitter?.title ?? openGraph?.title ?? title! }]
        : []),
      ...((twitter?.description ?? openGraph?.description ?? metadata.description)
        ? [
            {
              name: "twitter:description",
              content: twitter?.description ?? openGraph?.description ?? metadata.description!,
            },
          ]
        : []),
      ...(twitterImage ? [{ name: "twitter:image", content: imageUrl(twitterImage) }] : []),
    ],
    links: canonical ? [{ rel: "canonical", href: absoluteUrl(canonical) }] : [],
  };
}
