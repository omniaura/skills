---
title: Debounce Effects with on() and onCleanup
impact: MEDIUM
impactDescription: prevents excessive API calls and recomputations
tags: reactivity, effects, debounce, on, cleanup
---

## Debounce Effects with on() and onCleanup

**Impact: MEDIUM (prevents excessive API calls and recomputations)**

Use `on()` to explicitly track the input signal and `onCleanup` to cancel pending timers. This creates a clean debounce pattern without external libraries. Don't create effects that fire on every keystroke without debouncing.

**Incorrect (effect fires on every change, no debounce):**

```typescript
import { createEffect } from "solid-js"

// ❌ Fires API call on every keystroke
createEffect(() => {
  const term = searchInput()
  if (term.length > 2) {
    performSearch(term)  // Hammers the API
  }
})
```

**Correct (debounced with on() + onCleanup):**

```typescript
import { createEffect, on, onCleanup } from "solid-js"

// ✅ Only fires 300ms after user stops typing
createEffect(on(
  () => searchInput(),
  (input) => {
    const timer = setTimeout(() => {
      performSearch(input)
    }, 300)
    onCleanup(() => clearTimeout(timer))
  }
))
```

**With deferred initial run (skip search on mount):**

```typescript
createEffect(on(
  () => searchInput(),
  (input) => {
    if (!input) return
    const timer = setTimeout(() => performSearch(input), 300)
    onCleanup(() => clearTimeout(timer))
  },
  { defer: true }  // Don't search on initial mount
))
```

**Key points:**
- `on()` ensures only the input signal is tracked — timer state doesn't cause re-runs
- `onCleanup` runs before each re-execution, cancelling the previous timer
- Add `{ defer: true }` to avoid triggering on mount
- For more complex debounce needs, consider `@solid-primitives/scheduled`

Reference: [SolidJS on()](https://docs.solidjs.com/reference/reactive-utilities/on)
