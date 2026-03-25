---
title: Use throwOnError with ErrorBoundary for Query Errors
impact: MEDIUM
impactDescription: declarative error handling without manual checks
tags: data-fetching, solid-query, error-handling, suspense
---

## Use throwOnError with ErrorBoundary for Query Errors

**Impact: MEDIUM (declarative error handling without manual checks)**

Use `throwOnError: true` on queries to let errors bubble to the nearest `ErrorBoundary`. This pairs naturally with `Suspense` for a clean loading/error/success pattern. Don't manually check `query.isError` in every component.

**Incorrect (manual error checking in every component):**

```typescript
function UserList() {
  const query = createQuery(() => ({
    queryKey: ["users"],
    queryFn: fetchUsers,
  }))

  // ❌ Every component repeats this boilerplate
  return (
    <div>
      <Show when={query.isError}>
        <div class="error">{query.error?.message}</div>
      </Show>
      <Show when={query.isLoading}>
        <Spinner />
      </Show>
      <Show when={query.data}>
        <For each={query.data}>{(user) => <UserCard user={user} />}</For>
      </Show>
    </div>
  )
}
```

**Correct (throwOnError + ErrorBoundary):**

```typescript
function UserList() {
  const query = createQuery(() => ({
    queryKey: ["users"],
    queryFn: fetchUsers,
    throwOnError: true,  // Errors bubble to nearest ErrorBoundary
  }))

  // ✅ Only renders on success — errors and loading handled by boundaries
  return (
    <For each={query.data}>
      {(user) => <UserCard user={user} />}
    </For>
  )
}

// Parent provides declarative error + loading handling
function UsersPage() {
  return (
    <ErrorBoundary fallback={(err) => <UserListError error={err} />}>
      <Suspense fallback={<UserListSkeleton />}>
        <UserList />
      </Suspense>
    </ErrorBoundary>
  )
}
```

**Key points:**
- `ErrorBoundary` must wrap `Suspense` (errors first, then loading)
- Combine with `Suspense` for automatic loading states
- Use per-section boundaries to prevent one failing query from taking down the whole page

Reference: [TanStack Query Error Handling](https://tanstack.com/query/latest/docs/framework/solid/guides/suspense)
