---
title: Use createMiddleware() for Centralized Auth and Request Processing
impact: HIGH
impactDescription: Duplicated auth checks, inconsistent guard logic, missed routes
tags: solidstart, middleware, auth, security, request-handling
---

## Use createMiddleware() for Centralized Auth and Request Processing

**Impact: HIGH (duplicated auth checks, inconsistent guard logic, missed routes)**

SolidStart middleware runs before route handlers, providing a single place for auth guards, redirects, and request logging. Without it, auth checks get duplicated across every server function.

**Incorrect (duplicated auth checks in every server function):**

```typescript
const getProfile = query(async () => {
  "use server";
  const session = await getSession();
  if (!session.userId) throw redirect("/login"); // repeated everywhere
  return db.users.get(session.userId);
}, "profile");

const updateProfile = action(async (formData: FormData) => {
  "use server";
  const session = await getSession();
  if (!session.userId) throw redirect("/login"); // same check, duplicated
  // ...
});
```

**Correct (centralized middleware — app.config.ts + src/middleware/index.ts):**

```typescript
// app.config.ts
import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  middleware: "src/middleware/index.ts",
});
```

```typescript
// src/middleware/index.ts
import { createMiddleware } from "@solidjs/start/middleware";
import { redirect } from "@solidjs/router";
import { getCookie } from "vinxi/http";
import type { FetchEvent } from "@solidjs/start/server";

const PROTECTED_PATHS = ["/dashboard", "/settings", "/profile"];

function authGuard(event: FetchEvent) {
  const { pathname } = new URL(event.request.url);
  if (PROTECTED_PATHS.some((p) => pathname.startsWith(p))) {
    const session = getCookie(event.nativeEvent, "session");
    if (!session) return redirect("/login");
    event.locals.sessionId = session;
  }
}

function logger(event: FetchEvent) {
  event.locals.startTime = Date.now();
}

function logDuration(event: FetchEvent) {
  const ms = Date.now() - event.locals.startTime;
  console.log(`${event.request.method} ${event.request.url} — ${ms}ms`);
}

export default createMiddleware({
  onRequest: [authGuard, logger],
  onBeforeResponse: [logDuration],
});
```

**Accessing middleware data in server functions via getRequestEvent():**

```typescript
import { getRequestEvent } from "solid-js/web";
import { query } from "@solidjs/router";

const getProfile = query(async () => {
  "use server";
  const event = getRequestEvent();
  const sessionId = event?.locals?.sessionId; // populated by middleware
  return db.users.getBySession(sessionId);
}, "profile");
```

**Key points:**

- `onRequest` runs before route handlers; `onBeforeResponse` runs after
- Return `redirect()` or `json()` from `onRequest` to short-circuit
- `event.locals` passes request-scoped data to server functions
- Use `event.nativeEvent` for `vinxi/http` cookie utilities
- Must be a default export from the configured middleware file

Reference: [SolidStart Middleware](https://docs.solidjs.com/solid-start/advanced/middleware)
