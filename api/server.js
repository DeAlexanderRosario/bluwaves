// Vercel Node.js serverless function — SSR adapter for TanStack Start.
// `npm run build` runs first and produces dist/server/server.js (the TanStack
// Start SSR bundle). This file is then bundled by Vercel with esbuild.
import server from "../dist/server/server.js";

export default async function handler(req, res) {
  const protocol =
    req.headers["x-forwarded-proto"]?.split(",")[0] ?? "https";
  const host =
    req.headers["x-forwarded-host"] ?? req.headers["host"] ?? "localhost";
  const url = new URL(req.url, `${protocol}://${host}`);

  // Copy incoming Node.js headers into a Web API Headers object
  const headers = new Headers();
  for (const [key, val] of Object.entries(req.headers)) {
    if (val == null) continue;
    headers.set(key, Array.isArray(val) ? val.join(", ") : val);
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const request = new Request(url.toString(), {
    method: req.method,
    headers,
    ...(hasBody ? { body: req, duplex: "half" } : {}),
  });

  // Pass env vars explicitly so the SSR bundle can access them
  const env = {
    MONGODB_URI: process.env.MONGODB_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };

  const response = await server.fetch(request, env, {});

  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  const buf = Buffer.from(await response.arrayBuffer());
  res.end(buf);
}
