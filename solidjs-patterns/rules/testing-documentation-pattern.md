---
title: Write documentation tests as living pattern references
impact: LOW
impactDescription: Pattern knowledge lost when not captured in test suite
tags: testing, documentation, patterns, conventions
---

## Write documentation tests as living pattern references

**Impact: LOW-MEDIUM — pattern knowledge lost when not captured in test suite**

Use describe/it blocks to document recommended patterns as executable test files. These serve as searchable, always-up-to-date reference material that breaks if the API changes.

**Incorrect (patterns documented only in comments or markdown):**

```typescript
// patterns.md or inline comments
// When working with stores, use the path syntax for nested updates:
// setState("user", "profile", "name", newName)
//
// Don't do: state.user.profile.name = newName
```

**Correct (patterns captured as runnable test documentation):**

```typescript
import { createRoot } from "solid-js"
import { createStore } from "solid-js/store"

describe("Store update patterns", () => {
  it("documents: nested path updates for deep store state", () => {
    createRoot((dispose) => {
      const [state, setState] = createStore({
        user: { profile: { name: "Alice", age: 30 } },
      })

      // ✅ Path syntax for nested updates — triggers fine-grained reactivity
      setState("user", "profile", "name", "Bob")
      expect(state.user.profile.name).toBe("Bob")

      // ✅ Functional update at nested path
      setState("user", "profile", "age", (prev) => prev + 1)
      expect(state.user.profile.age).toBe(31)

      dispose()
    })
  })

  it("documents: array item updates by index", () => {
    createRoot((dispose) => {
      const [state, setState] = createStore({ items: ["a", "b", "c"] })

      // ✅ Update specific array index — only that index rerenders
      setState("items", 1, "B")
      expect(state.items[1]).toBe("B")

      dispose()
    })
  })
})
```

Documentation tests are valuable because:
- They break when APIs change, unlike markdown docs
- They're discoverable via test runner output and IDE search
- They serve as copy-paste starting points for real code

Reference: [Vitest — Organizing Tests](https://vitest.dev/guide/)
