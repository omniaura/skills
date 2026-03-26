---
title: Use Store Path Syntax for Surgical Nested Updates
impact: MEDIUM-HIGH
impactDescription: "unnecessary re-renders from coarse updates"
tags: stores, state, nested, performance
---

## Use Store Path Syntax for Surgical Nested Updates

**Impact: MEDIUM-HIGH (unnecessary re-renders from coarse updates)**

Store setters accept path arguments that update specific nested properties without touching sibling values. This is the most common and efficient way to update stores — each path segment narrows the update scope so only subscribers of that exact path re-render. Use path syntax for single-property updates; use `produce()` when you need to update multiple properties atomically.

**Incorrect (replacing entire objects for a single field change):**

```typescript
const [state, setState] = createStore({
  users: [
    { id: 1, name: "Alice", prefs: { theme: "dark" } },
    { id: 2, name: "Bob", prefs: { theme: "light" } },
  ],
  count: 0,
})

// BAD: replaces entire users array — all user components re-render
setState({
  ...state,
  users: state.users.map(u =>
    u.id === 2 ? { ...u, name: "Robert" } : u
  ),
})

// BAD: replaces entire user object — all fields re-render
setState("users", 0, { ...state.users[0], prefs: { ...state.users[0].prefs, theme: "light" } })
```

**Correct (path syntax for surgical updates):**

```typescript
const [state, setState] = createStore({
  users: [
    { id: 1, name: "Alice", prefs: { theme: "dark" } },
    { id: 2, name: "Bob", prefs: { theme: "light" } },
  ],
  count: 0,
})

// Update nested property by index path — only theme subscribers re-render
setState("users", 0, "prefs", "theme", "light")

// Update by predicate — find user with id === 2, update name
setState("users", u => u.id === 2, "name", "Robert")

// Functional update at path
setState("count", c => c + 1)

// Append to array
setState("users", state.users.length, {
  id: 3, name: "Carol", prefs: { theme: "dark" },
})

// Remove from array (filter returns new array for that path)
setState("users", users => users.filter(u => u.id !== 2))
```

When to use `produce()` instead:
```typescript
import { produce } from "solid-js/store"

// Multiple mutations in one pass — produce is cleaner here
setState(produce(s => {
  s.users[0].name = "Alicia"
  s.users[0].prefs.theme = "light"
  s.count += 1
}))
```

Rule of thumb: path syntax for 1-2 property updates, `produce()` for 3+ or complex mutations.

Reference: [SolidJS Store API](https://docs.solidjs.com/concepts/stores)
