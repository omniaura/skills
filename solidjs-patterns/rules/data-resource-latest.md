---
title: Use resource.latest for Stale-While-Revalidate UI
impact: MEDIUM
impactDescription: "UI flashes loading spinner on refetch instead of showing stale data"
tags: data, resource, stale-while-revalidate, UX
---

## Use resource.latest for Stale-While-Revalidate UI

**Impact: MEDIUM (UI flashes loading spinner on refetch instead of showing stale data)**

When a `createResource` refetches (source signal changes, `refetch()` called), `resource()` returns `undefined` during the pending state, triggering Suspense fallbacks. Use `resource.latest` to keep showing the previous data while the new data loads.

**Incorrect (UI flashes to loading on every refetch):**

```typescript
const [page, setPage] = createSignal(1)
const [data] = createResource(page, fetchPage)

// BAD: data() returns undefined during refetch → triggers Suspense fallback
return (
  <Suspense fallback={<Spinner />}>
    <div>{data()?.title}</div>  {/* Flashes to spinner on page change */}
  </Suspense>
)
```

**Correct (stale data stays visible while new data loads):**

```typescript
const [page, setPage] = createSignal(1)
const [data] = createResource(page, fetchPage)

return (
  <div>
    <Show when={data.loading}>
      <div class="overlay-spinner" />  {/* Subtle loading indicator */}
    </Show>
    <div style={{ opacity: data.loading ? 0.6 : 1 }}>
      {data.latest?.title}  {/* Shows previous page while new page loads */}
    </div>
  </div>
)
```

**resource() vs resource.latest:**

| Accessor | During Initial Load | During Refetch | On Error |
|----------|-------------------|----------------|----------|
| `resource()` | `undefined` | `undefined` | throws |
| `resource.latest` | `undefined` | Previous value | Previous value |

**Combine with useTransition for route-level stale-while-revalidate:**

```typescript
const [isPending, start] = useTransition()
const navigate = (page: number) => start(() => setPage(page))

// isPending() is true while new data loads — dim the current content
<div style={{ opacity: isPending() ? 0.6 : 1 }}>
  <PageContent data={data} />
</div>
```

**With initialValue for type safety:**

```typescript
// Without initialValue: data() can be undefined
const [data] = createResource(source, fetcher)

// With initialValue: data() always returns T (never undefined)
const [data] = createResource(source, fetcher, { initialValue: [] })
// data.latest is also always T
```

**Notes:**
- `resource.latest` is the built-in stale-while-revalidate primitive — no external library needed
- Pair with `data.loading` for subtle loading indicators (opacity, overlay spinners) instead of full Suspense fallbacks
- Use `resource.state` for fine-grained status: `"unresolved"`, `"pending"`, `"ready"`, `"refreshing"`, `"errored"`
- This pattern is especially valuable for pagination, search-as-you-type, and dashboard auto-refresh

Reference: [SolidJS createResource](https://docs.solidjs.com/reference/basic-reactivity/create-resource)
