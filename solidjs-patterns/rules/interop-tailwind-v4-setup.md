---
title: Configure Tailwind CSS v4 with SolidJS Using Vite Plugin
impact: MEDIUM
impactDescription: "broken styles or unnecessary PostCSS overhead"
tags: tailwind, css, vite, styling
---

## Configure Tailwind CSS v4 with SolidJS Using Vite Plugin

**Impact: MEDIUM (broken styles or unnecessary PostCSS overhead)**

Tailwind CSS v4 replaces `tailwind.config.js` with a CSS-first `@theme` directive and uses a dedicated Vite plugin instead of PostCSS. In SolidJS projects, use `@tailwindcss/vite` (not the PostCSS plugin) and place it before `vite-plugin-solid` in the plugins array. Define design tokens with `@theme` and consume them via CSS variables in dynamic styles.

**Incorrect (v3 config approach or wrong plugin order):**

```typescript
// vite.config.ts
// BAD: using PostCSS plugin instead of Vite plugin
import solidPlugin from "vite-plugin-solid"

export default defineConfig({
  plugins: [solidPlugin()],
  css: {
    postcss: { plugins: [require("tailwindcss")] }, // v3 approach
  },
})
```

```css
/* BAD: v3 directives don't work in v4 */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Correct (v4 Vite plugin + CSS-first config):**

```typescript
// vite.config.ts
import tailwindcss from "@tailwindcss/vite"
import solidPlugin from "vite-plugin-solid"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [
    tailwindcss(), // must come before solidPlugin
    solidPlugin(),
  ],
})
```

```css
/* src/index.css — Tailwind v4 */
@import "tailwindcss";

@theme {
  --color-primary: hsl(220 90% 56%);
  --color-surface: hsl(220 15% 96%);
  --font-body: "Inter", sans-serif;
  --breakpoint-xl: 1280px;
}
```

```tsx
// Using theme tokens in dynamic SolidJS styles
function Card(props: { highlight: boolean }) {
  return (
    <div
      class="rounded-lg p-4 font-body"
      classList={{ "bg-primary text-white": props.highlight }}
      style={{
        // Access theme tokens as CSS variables for dynamic styles
        "border-color": props.highlight
          ? "var(--color-primary)"
          : "var(--color-surface)",
      }}
    >
      {props.children}
    </div>
  )
}
```

Key differences from v3:
- `@import "tailwindcss"` replaces `@tailwind base/components/utilities`
- `@theme {}` replaces `tailwind.config.js` — all tokens are CSS-native
- Theme values become CSS variables automatically (e.g., `--color-primary`)
- Use `@tailwindcss/vite` plugin, not PostCSS

Reference: [Tailwind CSS v4 SolidJS Installation](https://tailwindcss.com/docs/installation/framework-guides/solidjs)
