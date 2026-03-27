---
title: Never Access Query Data at Component Top Level
impact: CRITICAL
impactDescription: creates a static snapshot that never updates — UI shows stale data
tags: solid-query, reactivity, data-fetching, top-level
---

## Never Access Query Data at Component Top Level

**Impact: CRITICAL (creates a static snapshot that never updates — UI shows stale data)**

Assigning `query.data?.prop` to a `const` at the component top level captures the value once at component creation. Since SolidJS components run once (not per-render), the variable never updates when the query resolves or refetches.

**Incorrect (top-level access creates static snapshot):**

```typescript
const query = createQuery(() => ({
  queryKey: ["user"],
  queryFn: fetchUser,
}))

const userName = query.data?.name  // ❌ Captured once — always undefined or stale

return <div>{userName}</div>  // Never updates
```

**Correct (access inside JSX or createMemo):**

```typescript
const query = createQuery(() => ({
  queryKey: ["user"],
  queryFn: fetchUser,
}))

// Option A: Direct access in JSX — reactive
return <div>{query.data?.name}</div>

// Option B: Derived with createMemo — reactive + cached
const userName = createMemo(() => query.data?.name)
return <div>{userName()}</div>
```

**Key insight:** In SolidJS, the component function body runs once. Only code inside reactive contexts (JSX expressions, `createMemo`, `createEffect`) re-runs when dependencies change.

Reference: [Solid Query Overview](https://tanstack.com/query/latest/docs/solid/overview)
