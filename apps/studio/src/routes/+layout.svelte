<script lang="ts">
  import { env } from "$env/dynamic/public";
  import posthog from "posthog-js";
  import { onMount } from "svelte";
  import "../app.css";

  let { children } = $props();

  const siteName = "Rail Radar";
  const title = "Rail Studio - Station Manager";
  const description =
    "Contributor workspace for curating Rail Radar's train station dataset across Europe.";
  const url = "https://studio.railradar24.com";
  const image = `${url}/og-image.webp`;

  onMount(() => {
    document.documentElement.classList.add("dark");

    if (env.PUBLIC_POSTHOG_KEY) {
      posthog.init(env.PUBLIC_POSTHOG_KEY, {
        api_host: "https://t.railradar24.com",
        ui_host: "https://eu.posthog.com",
        defaults: "2026-05-30",
        persistence: "memory",
        autocapture: false,
        capture_performance: { web_vitals: true },
      });
    }
  });
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <meta name="application-name" content={title} />
  <meta name="apple-mobile-web-app-title" content={title} />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="theme-color" content="#09090b" />
  <meta name="color-scheme" content="dark" />
  <link rel="canonical" href={url} />

  <meta property="og:type" content="website" />
  <meta property="og:url" content={url} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:site_name" content={siteName} />
  <meta property="og:image" content={image} />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={image} />
</svelte:head>

{@render children()}
