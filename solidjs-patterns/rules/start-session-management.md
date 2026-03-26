---
title: Use Vinxi useSession for Encrypted Cookie Sessions
impact: HIGH
impactDescription: "insecure session handling or server-side leaks"
tags: solidstart, auth, sessions, security
---

## Use Vinxi useSession for Encrypted Cookie Sessions

**Impact: HIGH (insecure session handling or server-side leaks)**

SolidStart session management uses `useSession` from `vinxi/http` with encrypted cookies. Sessions must only be called inside `"use server"` functions — calling them on the client exposes the encryption password. Always wrap session access in a typed helper for reuse and type safety.

**Incorrect (session accessed outside server context):**

```typescript
import { useSession } from "vinxi/http"

// BAD: calling useSession at module level or in a component
// exposes the encryption password to the client bundle
const session = useSession({ password: "my-secret" })

function Dashboard() {
  // BAD: password hardcoded and too short
  const s = useSession({ password: "short" })
  return <div>{s.data.userId}</div>
}
```

**Correct (server-only helper with typed sessions):**

```typescript
import { useSession } from "vinxi/http"

type UserSession = { userId: string; role: "admin" | "user" }

function getSession() {
  "use server"
  return useSession<UserSession>({
    password: process.env.SESSION_SECRET!, // 32+ characters
    name: "app-session",
  })
}

async function login(userId: string, role: "admin" | "user") {
  "use server"
  const session = await getSession()
  await session.update({ userId, role }) // use update(), never mutate directly
}

async function logout() {
  "use server"
  const session = await getSession()
  await session.clear()
}

async function requireUser() {
  "use server"
  const session = await getSession()
  if (!session.data.userId) throw redirect("/login")
  return session.data
}
```

Key rules:
- Password must be 32+ characters, loaded from environment variables
- Always use `session.update()` — never mutate `session.data` directly
- Use `session.clear()` for logout
- Wrap in a typed helper function for reuse across server functions

Reference: [SolidStart Session Docs](https://docs.solidjs.com/solid-start/advanced/session)
