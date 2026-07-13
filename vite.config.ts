import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    env.VITE_SUPABASE_URL ||
    env.SUPABASE_URL;

  const supabasePublishableKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing Supabase environment variables during Azure build.",
    );
  }

  return {
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

    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),

      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        supabasePublishableKey,
      ),

      "process.env.SUPABASE_URL": JSON.stringify(supabaseUrl),

      "process.env.SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        supabasePublishableKey,
      ),
    },

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
  };
});
