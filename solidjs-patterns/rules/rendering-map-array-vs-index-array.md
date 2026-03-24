---
title: Choose mapArray vs indexArray based on what changes
impact: MEDIUM
impactDescription: Wrong utility causes unnecessary remapping on updates
tags: rendering, arrays, mapArray, indexArray, performance
---

## Choose mapArray vs indexArray based on what changes

**Impact: MEDIUM — wrong utility causes unnecessary remapping on updates**

SolidJS provides two low-level array mapping utilities beneath `<For>` and `<Index>`. Choose based on whether items or indices change more often.

**Incorrect (using mapArray when item values change frequently):**

```typescript
import { mapArray, createSignal } from "solid-js"

// ❌ mapArray keys by reference — when item values change, it recreates mappings
const [prices, setPrices] = createSignal([10, 20, 30])

const formatted = mapArray(prices, (price, index) => {
  // This mapping function re-runs when items change by reference
  return `$${price.toFixed(2)}`
})

// Updating a value at index 1 replaces the reference → full remap
setPrices([10, 25, 30])
```

**Correct (indexArray for value changes, mapArray for structural changes):**

```typescript
import { mapArray, indexArray, createSignal } from "solid-js"

// ✅ indexArray: items change, indices are stable (e.g., live price updates)
const [prices, setPrices] = createSignal([10, 20, 30])

const formatted = indexArray(prices, (price, index) => {
  // price is a SIGNAL — reads the current value at this index
  return <span>${price().toFixed(2)}</span>
})

// ✅ mapArray: items are stable objects, indices change (e.g., add/remove/reorder)
const [users, setUsers] = createSignal<User[]>([])

const userCards = mapArray(users, (user, index) => {
  // user is a PLAIN VALUE — stable reference, index is a signal
  return <UserCard user={user} position={index()} />
})
```

**Rule of thumb:**
- `mapArray` (what `<For>` uses): Items are stable references, indices may change → use for object lists
- `indexArray` (what `<Index>` uses): Indices are stable, item values change → use for primitive lists

Most code should use `<For>` and `<Index>` components directly. Use the raw utilities only when you need reactive array mapping outside JSX.

Reference: [SolidJS API — mapArray](https://docs.solidjs.com/reference/reactive-utilities/map-array)
