---
title: Use stable unique IDs instead of array indices for list keys
impact: MEDIUM-HIGH
impactDescription: Incorrect DOM updates when lists are filtered or reordered
tags: rendering, For, keys, lists
---

## Use stable unique IDs instead of array indices for list keys

**Impact: MEDIUM-HIGH — incorrect DOM updates when lists are filtered or reordered**

When rendering lists that can be reordered, filtered, or have items removed, using array indices as keys causes DOM nodes to be associated with the wrong data. Use stable unique identifiers from your data instead.

**Incorrect (array index as key — breaks on reorder/filter):**

```typescript
<For each={filteredItems()}>
  {(item, index) => (
    // ❌ Index shifts when items are filtered/reordered
    // Item at index 2 gets the DOM state of whatever was at index 2 before
    <TodoItem key={index()} data={item} />
  )}
</For>
```

**Correct (stable unique ID as key):**

```typescript
<For each={filteredItems()}>
  {(item) => (
    // ✅ Stable ID follows the item through reorders and filters
    <TodoItem key={item.id} data={item} />
  )}
</For>
```

Note: SolidJS's `<For>` tracks items by reference by default, which handles most cases correctly without explicit keys. However, when items are recreated (e.g., from a server response where references change), explicit stable keys prevent DOM state mismatches.

For lists of primitives (numbers, strings) where values change but positions are stable, use `<Index>` instead of `<For>`:

```typescript
// ✅ <Index> for primitive lists with stable positions
<Index each={scores()}>
  {(score, index) => <span>#{index + 1}: {score()}</span>}
</Index>
```

Reference: [SolidJS — For Component](https://docs.solidjs.com/reference/components/for)
