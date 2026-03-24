---
title: Use createComputed for synchronous pre-render derived state
impact: MEDIUM
impactDescription: Stale derived values visible during first render
tags: reactivity, createComputed, derived-state, synchronous
---

## Use createComputed for synchronous pre-render derived state

**Impact: MEDIUM — stale derived values visible during first render**

`createComputed` runs synchronously *before* render when dependencies change, unlike `createEffect` which runs *after*. Use it when derived state must be available immediately — not lazily like `createMemo`.

**Incorrect (using createEffect for state that must be ready before render):**

```typescript
import { createSignal, createEffect } from "solid-js"

function UserGreeting() {
  const [firstName, setFirstName] = createSignal("John")
  const [lastName, setLastName] = createSignal("Doe")

  // ❌ createEffect runs AFTER render — greeting is stale on first paint
  let greeting = ""
  createEffect(() => {
    greeting = `Hello, ${firstName()} ${lastName()}!`
  })

  return <h1>{greeting}</h1> // Shows empty string on first render
}
```

**Correct (createComputed updates before render):**

```typescript
import { createSignal, createComputed } from "solid-js"

function UserGreeting() {
  const [firstName, setFirstName] = createSignal("John")
  const [lastName, setLastName] = createSignal("Doe")

  // ✅ createComputed runs BEFORE render — value is always in sync
  let greeting = ""
  createComputed(() => {
    greeting = `Hello, ${firstName()} ${lastName()}!`
  })

  return <h1>{greeting}</h1> // Shows "Hello, John Doe!" immediately
}
```

**When to prefer `createMemo` instead**: Most derived state should use `createMemo` — it's lazy, cached, and returns a signal. Only use `createComputed` when you need synchronous assignment to an external variable before render.

```typescript
// ✅ Prefer createMemo for most cases
const greeting = createMemo(() => `Hello, ${firstName()} ${lastName()}!`)
return <h1>{greeting()}</h1>
```

Reference: [SolidJS API — createComputed](https://docs.solidjs.com/reference/basic-reactivity/create-computed)
