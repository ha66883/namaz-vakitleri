<script lang="ts">
  import "../app.css";
  import { dev } from "$app/environment";
  import { injectAnalytics } from "@vercel/analytics/sveltekit";

  import { browser } from "$app/environment";
  injectAnalytics({ mode: dev ? "development" : "production" });

  let { children } = $props();

  if (browser) {
    import("virtual:pwa-register").then(({ registerSW }) => {
      registerSW({
        immediate: true,
      });
    });
  }
</script>

<svelte:head>
  <link rel="icon" href="/icon-192.png" />

  <link rel="apple-touch-icon" href="/icon-192.png" />

  <meta name="theme-color" content="#000000" />
</svelte:head>

{@render children()}
