---
title: Use Switch/Match for Mutually Exclusive Query States
impact: MEDIUM
impactDescription: prevents showing stale data during loading/error transitions
tags: data-fetching, solid-query, control-flow, rendering
---

## Use Switch/Match for Mutually Exclusive Query States

**Impact: MEDIUM (prevents showing stale data during loading/error transitions)**

Use `Switch`/`Match` instead of multiple `Show` components when handling query states. Query states (pending, error, success) are mutually exclusive — `Switch` enforces this and prevents rendering multiple states simultaneously.

**Incorrect (multiple Show components can overlap):**

```typescript
import { Show } from "solid-js"

function UserProfile(props: { userId: string }) {
  const query = createQuery(() => ({
    queryKey: ["user", props.userId],
    queryFn: () => fetchUser(props.userId),
  }))

  // ❌ Multiple Shows can render simultaneously during transitions
  return (
    <div>
      <Show when={query.isLoading}><Spinner /></Show>
      <Show when={query.error}><ErrorMessage error={query.error} /></Show>
      <Show when={query.data}><UserCard user={query.data!} /></Show>
    </div>
  )
}
```

**Correct (Switch/Match for exclusive states):**

```typescript
import { Switch, Match } from "solid-js"

function UserProfile(props: { userId: string }) {
  const query = createQuery(() => ({
    queryKey: ["user", props.userId],
    queryFn: () => fetchUser(props.userId),
  }))

  // ✅ Only one state renders at a time
  return (
    <Switch>
      <Match when={query.isPending}>
        <Skeleton />
      </Match>
      <Match when={query.isError}>
        <ErrorState error={query.error} retry={query.refetch} />
      </Match>
      <Match when={query.isSuccess}>
        <UserCard user={query.data!} />
      </Match>
    </Switch>
  )
}
```

**Key points:**
- Use `isPending` (not `isLoading`) — `isPending` is true when there's no cached data yet
- `Switch` evaluates `Match` conditions in order and renders only the first match
- For simple cases where you only need loading + data, `Show` with `fallback` is fine
- Combine with `Suspense`/`ErrorBoundary` at the parent level for even cleaner code

Reference: [SolidJS Switch/Match](https://docs.solidjs.com/reference/components/switch-and-match)
