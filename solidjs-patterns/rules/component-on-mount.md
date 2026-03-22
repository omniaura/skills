---
title: Use onMount for One-Time DOM Setup
impact: MEDIUM
impactDescription: ensures DOM is available before measurements or focus
tags: lifecycle, dom, setup
---

## Use onMount for One-Time DOM Setup

**Impact: MEDIUM (ensures DOM is available before measurements or focus)**

`onMount` runs once after the component's DOM is inserted. Use it for initial focus, DOM measurements, third-party library initialization, or any setup that requires real DOM elements. Unlike `createEffect`, it does not track dependencies and never re-runs.

**Incorrect (using createEffect for one-time setup):**

```tsx
function SearchInput() {
  let inputRef!: HTMLInputElement;

  createEffect(() => {
    inputRef.focus(); // Runs on every reactive change, not just mount
  });

  return <input ref={inputRef} />;
}
```

**Correct (onMount for one-time DOM work):**

```tsx
import { onMount } from "solid-js";

function SearchInput() {
  let inputRef!: HTMLInputElement;

  onMount(() => {
    inputRef.focus(); // Runs once after DOM insertion
  });

  return <input ref={inputRef} />;
}
```

**Correct (DOM measurements on mount):**

```tsx
function ResponsiveChart(props) {
  let containerRef!: HTMLDivElement;

  onMount(() => {
    const { width, height } = containerRef.getBoundingClientRect();
    initChart(containerRef, { width, height, data: props.data });
  });

  return <div ref={containerRef} class="chart-container" />;
}
```

Do not use `onMount` for reactive work — it won't re-run when signals change. For reactive side effects, use `createEffect`.

Reference: [SolidJS Docs - onMount](https://docs.solidjs.com/reference/lifecycle/on-mount)
