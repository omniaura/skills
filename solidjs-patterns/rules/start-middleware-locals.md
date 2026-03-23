---
title: Use createMiddleware with event.locals for Shared State
impact: HIGH
impactDescription: avoids global state leaks between requests and duplicated auth checks
tags: solidstart, middleware, auth, locals, createMiddleware
---

## Use createMiddleware with event.locals for Shared State

**Impact: HIGH (avoids global state leaks between requests and duplicated auth checks)**

SolidStart middleware runs before route handlers and server functions. Use `createMiddleware` with `event.locals` to share data (auth session, feature flags, request metadata) between middleware and downstream code — never use module-level globals which leak between requests.

**Incorrect (global state — leaks between concurrent requests):**

```typescript
// ❌ Module-level state shared across ALL requests
let currentUser: User | null = null;

export default defineConfig({
  middleware: async (event) => {
    currentUser = await verifySession(event.request);
  },
});

// In a server function
async function getData() {
  "use server";
  // ❌ currentUser could be from a different request
  if (!currentUser) throw new Error("Unauthorized");
}
```

**Correct (event.locals — scoped to the request):**

```typescript
// middleware.ts
import { createMiddleware } from "@solidjs/start/middleware";

export default createMiddleware({
  onRequest: [
    async (event) => {
      const session = await verifySession(event.request);
      event.locals.user = session?.user ?? null;
      event.locals.requestId = crypto.randomUUID();

      // Return a Response for early termination (e.g., auth guard)
      if (!session && isProtectedRoute(event.request.url)) {
        return new Response(null, {
          status: 302,
          headers: { Location: "/login" },
        });
      }
    },
  ],
  onBeforeResponse: [
    async (event) => {
      // Add headers, log timing, etc.
      event.response.headers.set("X-Request-Id", event.locals.requestId);
    },
  ],
});
```

```typescript
// app.config.ts — register middleware
import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  middleware: "./src/middleware.ts",
});
```

```typescript
// In server functions — access event.locals
import { getRequestEvent } from "solid-js/web";

async function getData() {
  "use server";
  const event = getRequestEvent()!;
  if (!event.locals.user) throw new Error("Unauthorized");
  return db.getData(event.locals.user.id);
}
```

**Key points:**
- `event.locals` is typed and scoped to a single request lifecycle
- Return a `Response` from `onRequest` for early termination (redirects, 401s)
- Register middleware in `app.config.ts`, not in route files
- Access locals in server functions via `getRequestEvent()`

Reference: [SolidStart Middleware](https://docs.solidjs.com/solid-start/advanced/middleware)
