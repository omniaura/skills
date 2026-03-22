---
title: Analyze and Optimize Bundle Size
impact: MEDIUM
impactDescription: reduces initial load time and improves TTI
tags: performance, bundle, vite, optimization
---

## Analyze and Optimize Bundle Size

**Impact: MEDIUM (reduces initial load time and improves TTI)**

SolidJS apps are small by default (~7KB runtime), but dependencies can bloat bundles quickly. Measure before optimizing, and target these metrics for production apps.

**Target metrics:**
- Initial bundle: < 200KB gzipped
- Per-route chunk: < 50KB gzipped
- Time to Interactive: < 3s on 4G
- Largest Contentful Paint: < 2.5s

**Analyze your bundle:**

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    solidPlugin(),
    visualizer({ open: true, gzipSize: true }),
  ],
});
```

**Common bloat sources and alternatives:**

```tsx
// WRONG — imports all of lodash (72KB)
import { debounce } from "lodash";

// CORRECT — import only what you need (1KB)
import debounce from "lodash-es/debounce";

// WRONG — moment.js (67KB + locales)
import moment from "moment";

// CORRECT — dayjs (2KB) or Temporal API
import dayjs from "dayjs";
```

**Tree-shaking checklist:**
- Use `lodash-es` instead of `lodash`
- Use `date-fns` or `dayjs` instead of `moment`
- Use `@iconify-json/*` with unplugin-icons instead of bundling icon libraries
- Set `"sideEffects": false` in package.json for your library code
- Use dynamic imports for heavy components: `lazy(() => import("./HeavyChart"))`

Reference: [Vite Build Optimization](https://vite.dev/guide/build)
