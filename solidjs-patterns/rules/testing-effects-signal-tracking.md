---
title: Test effects by tracking signal changes in createRoot
impact: LOW-MEDIUM
impactDescription: Missed effect regressions go undetected
tags: testing, effects, signals, createRoot
---

## Test effects by tracking signal changes in createRoot

**Impact: LOW-MEDIUM — missed effect regressions go undetected**

Effects run synchronously in SolidJS test contexts. Test them by collecting values in an array inside `createRoot`, then asserting after each signal update.

**Incorrect (testing effects without capturing values):**

```typescript
import { createRoot, createSignal, createEffect } from "solid-js"

it("effect runs on signal change", () => {
  createRoot((dispose) => {
    const [count, setCount] = createSignal(0)

    // ❌ No way to verify the effect actually ran or saw correct values
    createEffect(() => {
      console.log(count()) // Just logging — no assertion possible
    })

    setCount(1)
    dispose()
  })
})
```

**Correct (collecting effect calls for assertion):**

```typescript
import { createRoot, createSignal, createEffect } from "solid-js"

it("effect runs on signal change", () => {
  createRoot((dispose) => {
    const [count, setCount] = createSignal(0)
    const effectCalls: number[] = []

    createEffect(() => {
      effectCalls.push(count())
    })

    expect(effectCalls).toEqual([0]) // Effect ran once on init

    setCount(1)
    expect(effectCalls).toEqual([0, 1]) // Effect ran again

    setCount(5)
    expect(effectCalls).toEqual([0, 1, 5]) // Tracks every change

    dispose()
  })
})
```

The pattern works because SolidJS effects execute synchronously during tests, so assertions immediately after `setCount()` see the updated values. Always call `dispose()` to clean up the reactive scope.

Reference: [SolidJS Testing Guide](https://docs.solidjs.com/guides/testing)
