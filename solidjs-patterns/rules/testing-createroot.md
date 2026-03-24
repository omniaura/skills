---
title: Wrap Reactive Test Code in createRoot
impact: LOW-MEDIUM
impactDescription: Leaked reactive contexts, orphaned effects in tests
tags: testing, createRoot, vitest, reactive, cleanup
---

## Wrap Reactive Test Code in createRoot

**Impact: LOW-MEDIUM (leaked reactive contexts, orphaned effects in tests)**

Testing reactive primitives (signals, stores, effects) requires a reactive owner context. Use `createRoot` to provide one, and always call `dispose` for cleanup.

**Incorrect (reactive primitives without createRoot):**

```typescript
import { createSignal, createEffect } from "solid-js"

it("tracks signal changes", () => {
  // ❌ No reactive owner — createEffect has no context to register with
  const [count, setCount] = createSignal(0)
  const values: number[] = []

  createEffect(() => {
    values.push(count()) // May warn: "computations created outside a createRoot"
  })

  setCount(1)
  expect(values).toEqual([0, 1]) // Unreliable — effect may not track
})
```

**Correct (wrapped in createRoot with dispose):**

```typescript
import { createRoot } from "solid-js"
import { createStore } from "solid-js/store"

it("toggles items independently", () => {
  createRoot(dispose => {
    const [expanded, setExpanded] = createStore<boolean[]>([])

    setExpanded(0, true)
    expect(expanded[0]).toBe(true)

    setExpanded(1, true)
    expect(expanded[0]).toBe(true)   // unchanged
    expect(expanded[1]).toBe(true)

    dispose()  // Clean up reactive context
  })
})
```

**For hooks, use `renderHook`:**

```typescript
import { renderHook } from "@solidjs/testing-library"

it("increments counter", () => {
  const { result } = renderHook(() => useCounter())
  expect(result.count()).toBe(0)
  result.increment()
  expect(result.count()).toBe(1)
})
```

Reference: [Solid Testing Library](https://github.com/solidjs/solid-testing-library)
