---
title: Use query() + preload for Route-Level Auth Guards
impact: HIGH
impactDescription: "unauthorized access or flash of protected content"
tags: solidstart, auth, routing, preload
---

## Use query() + preload for Route-Level Auth Guards

**Impact: HIGH (unauthorized access or flash of protected content)**

When different routes need different auth requirements (admin-only vs authenticated vs public), use `query()` + `redirect()` in a route's `preload` function instead of global middleware. This is the idiomatic SolidStart approach for route-specific guards. Use `deferStream: true` in `createAsync` to ensure redirects fire before any content streams to the client.

**Incorrect (checking auth inside component body):**

```typescript
// BAD: auth check runs after component renders — flash of protected content
function AdminDashboard() {
  const session = createAsync(() => getSession())

  // BAD: redirect happens after initial render
  createEffect(() => {
    if (session() && session()!.role !== "admin") {
      navigate("/unauthorized")
    }
  })

  return <div>Admin content visible briefly before redirect</div>
}
```

**Correct (query + preload for server-side redirect):**

```typescript
// src/lib/auth.ts — reusable auth queries
import { query, redirect } from "@solidjs/router"

export const requireUser = query(async () => {
  "use server"
  const session = await getSession()
  if (!session.data.userId) throw redirect("/login")
  return db.users.get(session.data.userId)
}, "requireUser")

export const requireAdmin = query(async () => {
  "use server"
  const user = await requireUser()
  if (user.role !== "admin") throw redirect("/unauthorized")
  return user
}, "requireAdmin")

// src/routes/admin.tsx — layout guard for all /admin/* routes
import { type RouteSectionProps } from "@solidjs/router"
import { createAsync } from "@solidjs/router"
import { requireAdmin } from "~/lib/auth"

export const route = {
  preload: () => requireAdmin(), // runs before component
}

export default function AdminLayout(props: RouteSectionProps) {
  const user = createAsync(() => requireAdmin(), { deferStream: true })
  return (
    <Show when={user()}>
      {props.children}
    </Show>
  )
}

// src/routes/profile.tsx — different auth level, same pattern
import { requireUser } from "~/lib/auth"

export const route = {
  preload: () => requireUser(),
}

export default function Profile() {
  const user = createAsync(() => requireUser(), { deferStream: true })
  return <Show when={user()}>{u => <h1>Hello, {u().name}</h1>}</Show>
}
```

Key rules:
- Wrap auth checks in `query()` for deduplication and caching
- Use `throw redirect()` inside server functions — not `navigate()`
- Set `deferStream: true` on `createAsync` to block streaming until auth resolves
- Use layout routes to guard entire route subtrees
- Compose guards: `requireAdmin` can call `requireUser` internally

Reference: [SolidStart Auth Guide](https://docs.solidjs.com/solid-start/advanced/auth)
