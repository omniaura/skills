---
title: Use createInfiniteQuery for Paginated Data
impact: HIGH
impactDescription: eliminates manual pagination state management
tags: data-fetching, solid-query, pagination, infinite-scroll
---

## Use createInfiniteQuery for Paginated Data

**Impact: HIGH (eliminates manual pagination state management)**

Use `createInfiniteQuery` for cursor-based or offset-based pagination. Flatten pages with a derived signal, and use `hasPreviousPage`/`hasNextPage` for load-more controls. Don't roll manual pagination with `createQuery` + page signals.

**Incorrect (manual pagination with createQuery):**

```typescript
import { createSignal } from "solid-js"
import { createQuery } from "@tanstack/solid-query"

function MessageHistory(props: { conversationId: string }) {
  const [page, setPage] = createSignal(0)
  const [allMessages, setAllMessages] = createSignal<Message[]>([])

  const query = createQuery(() => ({
    queryKey: ["messages", props.conversationId, page()],
    queryFn: () => fetchMessages(props.conversationId, page()),
  }))

  // ❌ Manual accumulation, race conditions, no bidirectional loading
  createEffect(() => {
    if (query.data) {
      setAllMessages(prev => [...prev, ...query.data!.items])
    }
  })

  return (
    <div>
      <For each={allMessages()}>{(msg) => <Message data={msg} />}</For>
      <button onClick={() => setPage(p => p + 1)}>Load more</button>
    </div>
  )
}
```

**Correct (createInfiniteQuery with cursor-based pagination):**

```typescript
import { createInfiniteQuery } from "@tanstack/solid-query"

function MessageHistory(props: { conversationId: string }) {
  const query = createInfiniteQuery(() => ({
    queryKey: ["messages", props.conversationId],
    queryFn: ({ pageParam }) => fetchMessages(props.conversationId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    getPreviousPageParam: (firstPage) => firstPage.prevCursor,
  }))

  // ✅ Derived signal flattens all pages
  const allMessages = () => query.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <div>
      <Show when={query.hasPreviousPage}>
        <button
          onClick={() => query.fetchPreviousPage()}
          disabled={query.isFetchingPreviousPage}
        >
          {query.isFetchingPreviousPage ? "Loading..." : "Load older"}
        </button>
      </Show>

      <For each={allMessages()}>
        {(message) => <Message data={message} />}
      </For>

      <Show when={query.hasNextPage}>
        <button
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
        >
          {query.isFetchingNextPage ? "Loading..." : "Load newer"}
        </button>
      </Show>
    </div>
  )
}
```

**Key points:**
- `initialPageParam` sets the starting cursor (often `null` or `0`)
- `getNextPageParam`/`getPreviousPageParam` extract cursors from responses
- `query.data.pages` is an array of page responses — flatten with `.flatMap()`
- Don't destructure `query` — access `query.hasNextPage`, `query.fetchNextPage()` etc. reactively

Reference: [TanStack Solid Query Infinite Queries](https://tanstack.com/query/latest/docs/framework/solid/guides/infinite-queries)
