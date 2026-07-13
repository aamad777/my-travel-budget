import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart({
      server: {
        entry: "server",
      },
    }),
    nitro({
      preset: "node_server",
    }),
    react(),
  ],

  resolve: {
    alias: {
      "@": "/src",
    },
  },

  server: {
    host: "0.0.0.0",
  },

  preview: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: [
      "xb.dad-ai.online",
      "money.dad-ai.online",
      "localhost",
      "127.0.0.1",
      "192.168.0.113",
    ],
  },
});
