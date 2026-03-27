---
title: Access Query Data Directly in Effects — Don't Assign to Variables
impact: HIGH
impactDescription: effect never re-runs when query data updates
tags: solid-query, reactivity, effects, tracking
---

## Access Query Data Directly in Effects — Don't Assign to Variables

**Impact: HIGH (effect never re-runs when query data updates)**

Assigning `query.data` to a `const` inside an effect body captures the current value but does not create a reactive dependency. The effect tracks signal reads, not variable assignments. Access `query.data` directly each time you need it.

**Incorrect (variable assignment breaks tracking):**

```typescript
const query = createQuery(/* ... */)

createEffect(() => {
  const data = query.data  // ❌ Captured once — effect won't re-run
  if (data) {
    analytics.track("data_loaded", { count: data.length })
  }
})
```

**Correct (direct access creates reactive dependency):**

```typescript
const query = createQuery(/* ... */)

createEffect(() => {
  if (query.data) {  // ✅ Accessing query.data creates a dependency
    analytics.track("data_loaded", { count: query.data.length })
  }
})
```

**Why this happens:** SolidJS tracks property accesses on reactive objects (like query results from Solid Query). When you assign `const data = query.data`, the property is read once. The `data` variable is a plain JavaScript value — not reactive. Subsequent reads of `data` don't trigger re-tracking.

Reference: [Solid Query Overview](https://tanstack.com/query/latest/docs/solid/overview)
