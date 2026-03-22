---
title: Chain createMemo for Multi-Step Derived State
impact: MEDIUM
impactDescription: prevents redundant recomputation in derived state chains
tags: reactivity, memo, derived-state
---

## Chain createMemo for Multi-Step Derived State

**Impact: MEDIUM (prevents redundant recomputation in derived state chains)**

When derived state has multiple stages (filter → sort → count), chain `createMemo` calls so each intermediate result is cached independently. Downstream memos only recompute when their specific input changes.

**Incorrect (single monolithic derivation):**

```tsx
// Recomputes everything when any signal changes
const result = createMemo(() => {
  const filtered = items().filter((i) => i.category === filter());
  const sorted = filtered.sort((a, b) => a[sortBy()] - b[sortBy()]);
  return { items: sorted, count: sorted.length };
});
```

**Correct (chained memos with independent caching):**

```tsx
const filteredItems = createMemo(() =>
  items().filter((i) => i.category === filter())
);

const sortedItems = createMemo(() =>
  [...filteredItems()].sort((a, b) => a[sortBy()] - b[sortBy()])
);

const itemCount = createMemo(() => filteredItems().length);
```

Now when `sortBy` changes, only `sortedItems` recomputes — `filteredItems` and `itemCount` are cached. When `filter` changes, `filteredItems` recomputes first, then `sortedItems` and `itemCount` update only if the filtered result actually changed.

Reference: [SolidJS Docs - createMemo](https://docs.solidjs.com/reference/basic-reactivity/create-memo)
