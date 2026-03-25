---
title: Use on() with Array for Multiple Explicit Dependencies
impact: MEDIUM
impactDescription: prevents unwanted effect re-runs with precise dependency control
tags: reactivity, effects, on, explicit-tracking, previous-values
---

## Use on() with Array for Multiple Explicit Dependencies

**Impact: MEDIUM (prevents unwanted effect re-runs with precise dependency control)**

Pass an array of accessors to `on()` to track multiple signals explicitly. The callback receives current and previous values as arrays. Use `{ defer: true }` to skip the initial run. Don't use auto-tracking when you need previous values or want to ignore some signal reads.

**Incorrect (auto-tracking captures all reads, no previous values):**

```typescript
import { createEffect } from "solid-js"

// ❌ Tracks ALL signals read in body — including unrelated ones
createEffect(() => {
  const a = signalA()
  const b = signalB()
  const config = configSignal()  // Unintended dependency!

  // No access to previous values
  analytics.track("change", { a, b })
})
```

**Correct (on() with array for explicit deps + previous values):**

```typescript
import { createEffect, on } from "solid-js"

// ✅ Only tracks signalA and signalB, provides previous values
createEffect(on(
  [() => signalA(), () => signalB()],
  ([a, b], [prevA, prevB]) => {
    // configSignal() can be read here WITHOUT tracking
    const config = configSignal()

    if (prevA !== undefined) {
      analytics.track("change", { from: [prevA, prevB], to: [a, b] })
    }
  }
))

// ✅ With defer: skip initial run entirely
createEffect(on(
  () => searchTerm(),
  (term) => {
    // Won't run on mount, only on subsequent changes
    fetchResults(term)
  },
  { defer: true }
))
```

**Tuple shorthand (single accessor returning array):**

```typescript
// Also valid — single accessor returning a tuple
createEffect(on(
  () => [signalA(), signalB()] as const,
  ([a, b]) => {
    // Runs when either changes
  }
))
```

**Key points:**
- The callback body of `on()` is untracked — reads inside won't create dependencies
- Previous values are `undefined` on first run (unless `defer: true` skips it)
- Use `on()` when you need previous values, `defer`, or want to exclude some signal reads
- For simple effects where all reads should track, auto-tracking is simpler

Reference: [SolidJS on()](https://docs.solidjs.com/reference/reactive-utilities/on)
