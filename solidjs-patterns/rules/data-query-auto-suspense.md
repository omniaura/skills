---
title: Solid Query Integrates with Suspense Automatically
impact: MEDIUM
impactDescription: eliminates boilerplate loading state management
tags: solid-query, suspense, migration
---

## Solid Query Integrates with Suspense Automatically

**Impact: MEDIUM (eliminates boilerplate loading state management)**

Unlike React Query where you opt in with `useSuspenseQuery` or `suspense: true`, Solid Query queries automatically suspend inside `<Suspense>` boundaries. Any `createQuery` call nested within a Suspense boundary will trigger the fallback while loading — no configuration needed.

**Incorrect (React Query pattern — unnecessary in Solid):**

```tsx
// Don't copy this from React Query docs
const user = createQuery(() => ({
  queryKey: ["user", id()],
  queryFn: fetchUser,
  suspense: true, // This option doesn't exist in Solid Query
}));
```

**Correct (just wrap with Suspense):**

```tsx
function UserProfile(props) {
  const user = createQuery(() => ({
    queryKey: ["user", props.id()],
    queryFn: () => fetchUser(props.id()),
  }));

  // query.data is available directly — Suspense handles the loading state
  return <div>{user.data?.name}</div>;
}

// Parent provides the Suspense boundary
<Suspense fallback={<Skeleton />}>
  <UserProfile id={userId} />
</Suspense>
```

Similarly, `notifyOnChangeProps` is unnecessary — SolidJS's fine-grained reactivity automatically tracks which query properties (`.data`, `.isLoading`, etc.) are accessed in JSX.

Reference: [TanStack Solid Query Overview](https://tanstack.com/query/latest/docs/solid/overview)
