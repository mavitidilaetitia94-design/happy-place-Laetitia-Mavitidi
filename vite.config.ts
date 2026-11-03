// Configuration Vite standard (remplace @lovable.dev/vite-tanstack-config).
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
  },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://zftztrmbmcpzgxwmpybv.supabase.co"),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify("sb_publishable_cScFpCwDPCBXSbtf1I1WHw_w1x_1tPn"),
    "process.env.VITE_SUPABASE_URL": JSON.stringify("https://zftztrmbmcpzgxwmpybv.supabase.co"),
    "process.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify("sb_publishable_cScFpCwDPCBXSbtf1I1WHw_w1x_1tPn"),
    "process.env.SUPABASE_URL": JSON.stringify("https://zftztrmbmcpzgxwmpybv.supabase.co"),
    "process.env.SUPABASE_PUBLISHABLE_KEY": JSON.stringify("sb_publishable_cScFpCwDPCBXSbtf1I1WHw_w1x_1tPn"),
  },
  resolve: { dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"] },
  plugins: [
    tsConfigPaths(),
    tanstackStart({
      // Point d'entrée serveur : src/server.ts (page d'erreur propre en cas de plantage)
      server: { entry: "server" },
    }),
    nitro(),
    viteReact(),
    tailwindcss(),
  ],
});
