---
title: Use untrack() for Surgical Dependency Opt-Out
impact: MEDIUM
impactDescription: prevents unwanted effect re-runs from incidental signal reads
tags: reactivity, untrack, tracking
---

## Use untrack() for Surgical Dependency Opt-Out

**Impact: MEDIUM (prevents unwanted effect re-runs from incidental signal reads)**

`untrack()` reads a signal's value without creating a reactive dependency. Use it when you need to read a signal inside a tracking scope (effect, memo) but don't want that read to trigger re-execution. This is distinct from `on()`, which explicitly lists what to track.

**Incorrect (incidental dependency causes extra re-runs):**

```tsx
createEffect(() => {
  // Re-runs when EITHER searchQuery or debugMode changes
  console.log(`[debug=${debugMode()}] Searching: ${searchQuery()}`);
  performSearch(searchQuery());
});
```

**Correct (untrack the incidental read):**

```tsx
import { untrack } from "solid-js";

createEffect(() => {
  // Only re-runs when searchQuery changes
  console.log(`[debug=${untrack(debugMode)}] Searching: ${searchQuery()}`);
  performSearch(searchQuery());
});
```

**Common use cases:**

```tsx
// Read initial value without tracking
const initialValue = untrack(count);

// Log without creating dependency
createEffect(() => {
  const result = computeResult(input());
  console.log("Previous count was:", untrack(count));
  setOutput(result);
});

// Conditional tracking
createEffect(() => {
  const mode = trackingMode();
  if (mode === "detailed") {
    doDetailed(details()); // tracked
  } else {
    doSimple(untrack(details)); // not tracked in simple mode
  }
});
```

**When to use `untrack()` vs `on()`:**
- `untrack()` — opt OUT of tracking specific reads within an effect
- `on()` — opt IN to tracking specific signals (ignore everything else)

Reference: [SolidJS Docs - untrack](https://docs.solidjs.com/reference/reactive-utilities/untrack)
