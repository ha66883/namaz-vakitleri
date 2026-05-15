import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

import { SvelteKitPWA } from "@vite-pwa/sveltekit";

export default defineConfig({
  plugins: [
    tailwindcss(),

    sveltekit(),

    SvelteKitPWA({
      strategies: "generateSW",

      registerType: "autoUpdate",

      injectRegister: "auto",

      devOptions: {
        enabled: true,
      },
      manifest: {
        name: "Namaz Vakitleri",

        short_name: "Namaz",

        description: "Namaz vakitleri ve günlük hadis uygulaması",

        theme_color: "#000000",

        background_color: "#000000",

        display: "standalone",

        start_url: "/",

        orientation: "portrait",

        icons: [
          {
            src: "icon-192.png",

            sizes: "192x192",

            type: "image/png",

            purpose: "any maskable",
          },

          {
            src: "icon-512.png",

            sizes: "512x512",

            type: "image/png",

            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
});
