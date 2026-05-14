// Pass `cloudflare: false` to prevent @lovable.dev/vite-tanstack-config from injecting
// @cloudflare/vite-plugin during builds — that plugin produces a Cloudflare Worker bundle
// which is incompatible with Vercel. Setting server.preset = "vercel" targets Vercel's
// Node.js serverless runtime instead.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    server: { preset: "vercel" },
  },
});
