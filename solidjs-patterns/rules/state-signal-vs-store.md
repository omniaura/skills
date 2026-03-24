---
title: Choose Signal vs Store Based on Update Granularity
impact: HIGH
impactDescription: Over-updating (signal for collections) or unnecessary complexity (store for primitives)
tags: state, signal, store, collections, granularity
---

## Choose Signal vs Store Based on Update Granularity

**Impact: HIGH (over-updating or unnecessary complexity)**

Signals replace the entire value on update — all subscribers re-run. Stores provide per-property reactivity. Match the primitive to your update pattern.

**Incorrect (signal for a collection with per-item updates):**

```typescript
import { createSignal } from "solid-js"

// ❌ Every item update replaces the whole array — all list items rerender
const [todos, setTodos] = createSignal<Todo[]>([])

const toggleDone = (index: number) => {
  setTodos(prev => prev.map((t, i) =>
    i === index ? { ...t, done: !t.done } : t
  ))
  // Creates a new array → every <For> item callback re-evaluates
}
```

**Correct (store for per-item updates, signal for simple values):**

```typescript
import { createSignal } from "solid-js"
import { createStore } from "solid-js/store"

// ✅ Signal for primitives and fully-replaced objects
const [isOpen, setIsOpen] = createSignal(false)
const [position, setPosition] = createSignal({ x: 0, y: 0 })

// ✅ Store for collections with per-item updates
const [todos, setTodos] = createStore<Todo[]>([])

const toggleDone = (index: number) => {
  setTodos(index, "done", prev => !prev)
  // Only the component reading todos[index].done rerenders
}

// ✅ Store for complex nested state with partial updates
const [state, setState] = createStore({
  users: [],
  settings: { theme: "dark", lang: "en" }
})
setState("settings", "theme", "light")  // Only theme subscribers update
```

**Quick reference:**

| Use Case | Primitive | Why |
|----------|-----------|-----|
| Single value | `createSignal` | Simple, low overhead |
| Object replaced entirely | `createSignal` | No partial updates needed |
| List with per-item changes | `createStore` | Fine-grained per-index reactivity |
| Complex nested state | `createStore` | Path-based partial updates |
| Selection tracking (multi) | `createStore<Record<string, boolean>>` | O(1) per-key updates |
| Selection tracking (single) | `createSignal` + `createSelector` | O(1) with only 2 items updating |

Reference: [SolidJS Stores](https://docs.solidjs.com/concepts/stores)
