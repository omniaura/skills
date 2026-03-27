---
title: Set Performance Budgets for SolidJS Apps
impact: LOW
impactDescription: prevents bundle bloat and slow page loads
tags: performance, bundle, metrics, budgets
---

## Set Performance Budgets for SolidJS Apps

**Impact: LOW (prevents bundle bloat and slow page loads)**

SolidJS is fast by default, but lazy loading and bundle management still matter. Set concrete performance budgets and enforce them in CI.

**Incorrect (no budgets — bundle grows unchecked):**

```typescript
// No awareness of bundle impact
import _ from "lodash"                    // +70KB gzipped
import { marked } from "marked"           // +35KB gzipped
import { Chart } from "chart.js/auto"     // +60KB gzipped
// Total: 165KB just from imports — before any app code
```

**Correct (budgets enforced, heavy deps lazy-loaded):**

```typescript
// vite.config.ts — bundle size alerts
import { visualizer } from "rollup-plugin-visualizer"

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["solid-js", "@solidjs/router"],
        },
      },
    },
  },
  plugins: [visualizer({ gzipSize: true })],
})

// Lazy load heavy dependencies
const Chart = lazy(() => import("./ChartWrapper"))
const MarkdownRenderer = lazy(() => import("./MarkdownRenderer"))
```

**Target budgets:**

| Metric | Target | Tool |
|--------|--------|------|
| Initial bundle | < 200KB gzipped | `rollup-plugin-visualizer` |
| Route chunks | < 50KB per route | Vite build output |
| Time to Interactive | < 3s on 3G | Lighthouse |
| Largest Contentful Paint | < 2.5s | Lighthouse / Web Vitals |

**Common heavy dependencies to watch:**
- `lodash` (70KB) → use `lodash-es` with tree shaking or individual imports
- `chart.js/auto` (60KB) → lazy load, register only needed components
- `markdown-it + plugins` (50KB+) → lazy load behind `<Suspense>`

Reference: [Vite Build Options](https://vite.dev/config/build-options)
