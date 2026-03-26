---
title: Configure Nitro Presets for Target Deployment
impact: MEDIUM
impactDescription: "failed deployments or missing platform features"
tags: solidstart, deployment, nitro, cloudflare, docker
---

## Configure Nitro Presets for Target Deployment

**Impact: MEDIUM (failed deployments or missing platform features)**

SolidStart uses Nitro under the hood for server builds. Set `server.preset` in `app.config.ts` to match your deployment target. Each preset configures bundling, entry points, and platform-specific APIs correctly. Without the right preset, builds may fail or miss platform features like edge caching.

**Incorrect (wrong or missing preset):**

```typescript
// app.config.ts
import { defineConfig } from "@solidjs/start/config"

// BAD: deploying to Cloudflare without the preset
// Build output won't have the right entry point or bindings
export default defineConfig({})

// BAD: using Node APIs on Cloudflare Workers without compat flag
export default defineConfig({
  server: { preset: "cloudflare_pages" },
  // Missing: compatibilityFlags for Node.js APIs
})
```

**Correct (preset per deployment target):**

```typescript
// app.config.ts — Cloudflare Pages
import { defineConfig } from "@solidjs/start/config"

export default defineConfig({
  server: {
    preset: "cloudflare_pages",
    compatibilityFlags: ["nodejs_compat_v2"],
  },
})
```

```typescript
// app.config.ts — Vercel (serverless)
import { defineConfig } from "@solidjs/start/config"

export default defineConfig({
  server: {
    preset: "vercel",
  },
})
```

```typescript
// app.config.ts — Node.js / Docker (default)
import { defineConfig } from "@solidjs/start/config"

export default defineConfig({
  server: {
    preset: "node-server",
    // Or omit preset entirely — node-server is the default
  },
})
```

```dockerfile
# Docker deployment for node-server preset
FROM node:22-slim AS runtime
WORKDIR /app
COPY .output .output
ENV PORT=3000
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

```typescript
// app.config.ts — environment-based preset selection
import { defineConfig } from "@solidjs/start/config"

export default defineConfig({
  server: {
    preset: process.env.NITRO_PRESET || "node-server",
  },
})
```

Common presets: `node-server`, `cloudflare_pages`, `cloudflare_module`, `vercel`, `netlify`, `deno`, `bun`, `static` (SSG)

Reference: [Nitro Deploy Docs](https://nitro.build/deploy)
