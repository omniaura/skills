---
title: Use Synchronous Signals to Block UI During Async Pagination
impact: MEDIUM
impactDescription: prevents scroll-to-bottom jumping during paginated data loading
tags: reactivity, signals, pagination, async, scroll
---

## Use Synchronous Signals to Block UI During Async Pagination

**Impact: MEDIUM (prevents scroll-to-bottom jumping during paginated data loading)**

When loading older messages or paginated data, UI actions like scroll-to-bottom must be blocked during the async gap between requesting and receiving data. Use a synchronous signal set *before* the async call — don't rely on query state which updates *after* the request completes.

**Incorrect (relying on async query state — scroll jumps):**

```typescript
const handleLoadMore = () => {
  fetchNextPage()  // isFetchingNextPage updates AFTER this returns
}

createEffect(() => {
  if (!isFetchingNextPage) {
    scrollToBottom()  // ❌ Fires immediately before fetch state updates
  }
})
```

**Correct (synchronous signal blocks scroll during async gap):**

```typescript
const [isPaginatingNow, setIsPaginatingNow] = createSignal(false)

const handleLoadMore = () => {
  setIsPaginatingNow(true)  // ✅ Set IMMEDIATELY, BEFORE async call
  fetchNextPage()
}

// Clear after pagination completes
createEffect(() => {
  if (!isFetchingNextPage && isPaginatingNow()) {
    setTimeout(() => setIsPaginatingNow(false), 500)
  }
})

// Gate scroll-to-bottom on the synchronous signal
createEffect(() => {
  if (isPaginatingNow()) {
    return  // ✅ Block scroll-to-bottom during pagination
  }
  scrollToBottom()
})
```

**Key insight:** Signals are read when called — they always reflect the current value. Query state like `isFetchingNextPage` updates asynchronously after the network request begins. Use a synchronous signal to bridge the gap.

Reference: [SolidJS Signals](https://docs.solidjs.com/reference/basic-reactivity/create-signal)
