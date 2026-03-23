---
title: Check @solid-primitives Before Building Custom Hooks
impact: MEDIUM
impactDescription: reinventing well-tested utilities — wasted effort and edge case bugs
tags: interop, solid-primitives, ecosystem, hooks, utilities
---

## Check @solid-primitives Before Building Custom Hooks

**Impact: MEDIUM (reinventing well-tested utilities — wasted effort and edge case bugs)**

The `@solid-primitives` collection has 60+ individually tree-shakeable packages for common patterns. Before writing a custom reactive wrapper for browser APIs, check if a battle-tested primitive already exists.

**Incorrect (hand-rolled media query hook):**

```tsx
function useMediaQuery(query: string) {
  const [matches, setMatches] = createSignal(false);

  onMount(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    // ❌ Missing cleanup, SSR handling, edge cases
    mql.addEventListener("change", (e) => setMatches(e.matches));
  });

  return matches;
}
```

**Correct (use the tested primitive):**

```tsx
import { createMediaQuery } from "@solid-primitives/media";

// ✅ Handles cleanup, SSR, and edge cases
const isDesktop = createMediaQuery("(min-width: 1024px)");

// In JSX:
<Show when={isDesktop()} fallback={<MobileNav />}>
  <DesktopNav />
</Show>
```

**Key packages to know:**

| Package | Use Case |
|---------|----------|
| `@solid-primitives/storage` | localStorage/sessionStorage with signals |
| `@solid-primitives/media` | Media queries, prefers-color-scheme |
| `@solid-primitives/scheduled` | Debounce, throttle, leading/trailing |
| `@solid-primitives/resize-observer` | Element resize tracking |
| `@solid-primitives/intersection-observer` | Viewport visibility |
| `@solid-primitives/event-listener` | Auto-cleaned event listeners |
| `@solid-primitives/clipboard` | Clipboard read/write |
| `@solid-primitives/timer` | Reactive setTimeout/setInterval |
| `@solid-primitives/keyboard` | Key combos, hotkeys |
| `@solid-primitives/geolocation` | Reactive GPS position |

**Install only what you need:**

```bash
bun add @solid-primitives/media @solid-primitives/scheduled
```

Reference: [Solid Primitives](https://github.com/solidjs-community/solid-primitives)
