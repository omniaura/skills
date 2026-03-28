---
title: Use deferStream for Header-Modifying Queries
impact: MEDIUM
impactDescription: "Headers already sent" errors when server functions set cookies or redirect
tags: solidstart, ssr, streaming, deferStream, headers, cookies
---

## Use deferStream for Header-Modifying Queries

**Impact: MEDIUM ("headers already sent" errors when server functions set cookies or redirect)**

Once SolidStart begins streaming HTML, HTTP headers are locked. If a `createAsync` query modifies headers (sets cookies, triggers redirects), it must resolve _before_ streaming starts. Use `deferStream: true` to hold the stream until that query completes.

**Incorrect (streaming starts before auth query resolves):**

```typescript
export default function ProtectedPage() {
  // This query sets session cookies and may redirect
  const user = createAsync(() => getCurrentUser())

  return (
    <Suspense fallback={<Loading />}>
      <Dashboard user={user()} />
    </Suspense>
  )
  // ERROR: getCurrentUser() tries to set cookies after streaming began
}
```

**Correct (deferStream holds the stream for header-modifying queries):**

```typescript
export default function ProtectedPage() {
  // deferStream: true — stream waits for this query before sending headers
  const user = createAsync(() => getCurrentUser(), { deferStream: true })

  return (
    <Suspense fallback={<Loading />}>
      <Dashboard user={user()} />
    </Suspense>
  )
}
```

**When to use deferStream:**

- Server functions that call `setCookie()` or `deleteCookie()`
- Server functions that may `throw redirect()`
- Auth/session queries that gate the entire page

**When NOT to use deferStream:**

- Read-only data queries — let them stream normally
- Queries inside nested Suspense boundaries that don't touch headers

Reference: [SolidStart createAsync](https://docs.solidjs.com/reference/solid-router/data-apis/create-async)
