---
title: Use boolean array store for expandable/collapsible lists
impact: HIGH
impactDescription: O(n) rerenders → O(1) per toggle
tags: state, store, lists, fine-grained
---

## Use boolean array store for expandable/collapsible lists

**Impact: HIGH — O(n) rerenders → O(1) per toggle**

When each item in a list can be independently expanded or collapsed, use `createStore<boolean[]>` instead of a signal holding a Set or array. The store proxy tracks each index separately, so toggling one item only rerenders that item.

**Incorrect (signal holding a Set — every toggle rerenders all items):**

```typescript
import { createSignal } from "solid-js"

function CollapsibleList(props: { items: Item[] }) {
  // ❌ Every toggle creates a new Set, causing all items to recheck
  const [expanded, setExpanded] = createSignal(new Set<number>())

  const toggle = (index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(index) ? next.delete(index) : next.add(index)
      return next
    })
  }

  return (
    <For each={props.items}>
      {(item, index) => (
        <div>
          <button onClick={() => toggle(index())}>
            {expanded().has(index()) ? "Collapse" : "Expand"}
          </button>
          <Show when={expanded().has(index())}>
            <div>{item.content}</div>
          </Show>
        </div>
      )}
    </For>
  )
}
```

**Correct (store array — only the toggled index rerenders):**

```typescript
import { createStore } from "solid-js/store"

function CollapsibleList(props: { items: Item[] }) {
  // ✅ Store tracks each index independently
  const [expanded, setExpanded] = createStore<boolean[]>([])

  const toggle = (index: number) => {
    setExpanded(index, (prev) => !prev)
  }

  return (
    <For each={props.items}>
      {(item, index) => (
        <div>
          <button onClick={() => toggle(index())}>
            {expanded[index()] ? "Collapse" : "Expand"}
          </button>
          <Show when={expanded[index()]}>
            <div>{item.content}</div>
          </Show>
        </div>
      )}
    </For>
  )
}
```

`setExpanded(2, true)` only triggers updates for components reading `expanded[2]`. With 1000 items, toggling one item updates 1 component instead of 1000.

Reference: [SolidJS Store Documentation](https://docs.solidjs.com/concepts/stores)
