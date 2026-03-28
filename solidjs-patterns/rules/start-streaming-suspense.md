---
title: Use Nested Suspense Boundaries for Streaming SSR
impact: HIGH
impactDescription: Entire page blocks until slowest query resolves
tags: solidstart, ssr, streaming, suspense, performance
---

## Use Nested Suspense Boundaries for Streaming SSR

**Impact: HIGH (entire page blocks until slowest query resolves)**

SolidStart streams HTML by default. Each `<Suspense>` boundary defines an independent streaming chunk — without them, the entire page waits for the slowest data fetch. Nested Suspense boundaries let fast queries render immediately while slow ones show skeletons.

**Incorrect (no Suspense — entire page blocks):**

```typescript
export default function Dashboard() {
  const user = createAsync(() => getUser())    // 50ms
  const stats = createAsync(() => getStats())  // 200ms
  const feed = createAsync(() => getFeed())    // 800ms

  return (
    <div>
      <UserHeader user={user()} />
      <StatsPanel stats={stats()} />
      <ActivityFeed items={feed()} />
    </div>
  )
  // Nothing renders until getFeed() resolves at 800ms
}
```

**Correct (nested Suspense — each section streams independently):**

```typescript
import { Suspense, ErrorBoundary } from "solid-js"
import { query, createAsync } from "@solidjs/router"
import type { RouteDefinition } from "@solidjs/router"

export const route = {
  preload: () => { getUser(); getStats(); getFeed() }
} satisfies RouteDefinition

export default function Dashboard() {
  const user = createAsync(() => getUser())
  const stats = createAsync(() => getStats())
  const feed = createAsync(() => getFeed())

  return (
    <div>
      {/* Streams at 50ms */}
      <ErrorBoundary fallback={<div>Error loading user</div>}>
        <Suspense fallback={<UserSkeleton />}>
          <UserHeader user={user()} />
        </Suspense>
      </ErrorBoundary>

      <div class="grid grid-cols-2">
        {/* Streams at 200ms */}
        <Suspense fallback={<StatsSkeleton />}>
          <StatsPanel stats={stats()} />
        </Suspense>
        {/* Streams at 800ms */}
        <Suspense fallback={<FeedSkeleton />}>
          <ActivityFeed items={feed()} />
        </Suspense>
      </div>
    </div>
  )
}
```

**Key points:**

- Each `<Suspense>` boundary streams independently — fast queries don't wait for slow ones
- `ErrorBoundary` wraps `Suspense` (not inside it) to catch async failures
- `route.preload` fires all queries during navigation, before component renders
- Avoid `<Show when={data()}>` inside `<Suspense>` — it defeats Suspense pre-creation
- Streaming is the default with `ssr: true` (SolidStart default)

Reference: [SolidStart Data Loading](https://docs.solidjs.com/solid-start/building-your-application/data-loading)
