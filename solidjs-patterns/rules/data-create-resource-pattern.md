---
title: Use createResource for Standalone Async Data
impact: MEDIUM
impactDescription: provides built-in loading/error states and Suspense integration
tags: data-fetching, createResource, suspense
---

## Use createResource for Standalone Async Data

**Impact: MEDIUM (provides built-in loading/error states and Suspense integration)**

For non-SolidStart apps (or when you don't need Solid Router's caching), `createResource` is the built-in primitive for async data. It provides reactive loading/error states, integrates with Suspense, and supports `mutate` for optimistic updates.

**Incorrect (manual async state management):**

```tsx
function UserProfile(props) {
  const [user, setUser] = createSignal(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal(null);

  createEffect(async () => {
    setLoading(true);
    try {
      const data = await fetchUser(props.id());
      setUser(data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  });
  // Async in createEffect breaks tracking, manual state is error-prone
}
```

**Correct (createResource with Suspense):**

```tsx
import { createResource, Suspense, Show } from "solid-js";

function UserProfile(props) {
  const [user, { mutate, refetch }] = createResource(
    () => props.id(),   // reactive source — refetches when id changes
    (id) => fetchUser(id) // fetcher function
  );

  return (
    <Show when={!user.error} fallback={<p>Error: {user.error.message}</p>}>
      <div>{user()?.name}</div>
    </Show>
  );
}

// Wrap with Suspense for loading states
<Suspense fallback={<Skeleton />}>
  <UserProfile id={userId} />
</Suspense>
```

**When to use which:**
- `createResource` — standalone apps, simple fetching with mutate/refetch
- `createAsync` + `query` — SolidStart/Solid Router apps with route-level caching
- Solid Query — complex caching, pagination, infinite scroll, background refetching

Reference: [SolidJS Docs - createResource](https://docs.solidjs.com/reference/basic-reactivity/create-resource)
