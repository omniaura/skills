---
title: Choose signal vs store for selection state based on cardinality
impact: HIGH
impactDescription: Wrong primitive causes O(n) rerenders in large lists
tags: state, selection, signal, store, performance
---

## Choose signal vs store for selection state based on cardinality

**Impact: HIGH — wrong primitive causes O(n) rerenders in large lists**

Single-selection needs a signal holding the selected ID. Multi-selection needs a store with per-key tracking. Using the wrong one either wastes rerenders or adds unnecessary complexity.

**Incorrect (signal holding a Set for multi-selection):**

```typescript
import { createSignal } from "solid-js"

function MultiSelectList(props: { items: Item[] }) {
  // ❌ New Set on every toggle — all items rerender
  const [selected, setSelected] = createSignal(new Set<string>())

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <For each={props.items}>
      {(item) => (
        <div
          classList={{ selected: selected().has(item.id) }}
          onClick={() => toggle(item.id)}
        >
          {item.name}
        </div>
      )}
    </For>
  )
}
```

**Correct (signal for single-selection, store for multi-selection):**

```typescript
import { createSignal } from "solid-js"
import { createStore } from "solid-js/store"

// ✅ Single-selection: signal is perfect (one value changes)
function SingleSelectList(props: { items: Item[] }) {
  const [selectedId, setSelectedId] = createSignal<string | null>(null)

  return (
    <For each={props.items}>
      {(item) => (
        <div
          classList={{ selected: selectedId() === item.id }}
          onClick={() => setSelectedId(item.id)}
        >
          {item.name}
        </div>
      )}
    </For>
  )
}

// ✅ Multi-selection: store tracks each key independently
function MultiSelectList(props: { items: Item[] }) {
  const [selected, setSelected] = createStore<Record<string, boolean>>({})

  const toggle = (id: string) => {
    setSelected(id, (prev) => !prev)
  }

  return (
    <For each={props.items}>
      {(item) => (
        <div
          classList={{ selected: selected[item.id] }}
          onClick={() => toggle(item.id)}
        >
          {item.name}
        </div>
      )}
    </For>
  )
}
```

For single-selection with large lists, also consider `createSelector` (see `perf-create-selector` rule) for O(1) updates instead of O(n).

Reference: [SolidJS Store Documentation](https://docs.solidjs.com/concepts/stores)
