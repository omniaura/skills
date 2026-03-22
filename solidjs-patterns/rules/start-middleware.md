---
title: Use createMiddleware for Cross-Cutting Concerns
impact: HIGH
impactDescription: centralizes auth, logging, and headers across all routes
tags: solidstart, middleware, server
---

## Use createMiddleware for Cross-Cutting Concerns

**Impact: HIGH (centralizes auth, logging, and headers across all routes)**

SolidStart middleware runs for every request before route handlers execute. Use `createMiddleware` for authentication, logging, CORS headers, and request validation. Configure it in `app.config.ts`.

**Incorrect (duplicating auth checks in every server function):**

```tsx
// src/api/users.ts
const getUser = query(async (id: string) => {
  "use server";
  const session = await getSession(); // repeated everywhere
  if (!session) throw redirect("/login");
  return db.users.find(id);
}, "user");

// src/api/posts.ts
const getPosts = query(async () => {
  "use server";
  const session = await getSession(); // repeated everywhere
  if (!session) throw redirect("/login");
  return db.posts.list();
}, "posts");
```

**Correct (middleware handles auth once):**

```tsx
// src/middleware.ts
import { createMiddleware } from "@solidjs/start/middleware";

export default createMiddleware({
  onRequest: [
    (event) => {
      const session = getSessionFromCookie(event.request.headers);
      if (!session && isProtectedRoute(event.request.url)) {
        return Response.redirect("/login");
      }
      // Attach session to event locals for downstream use
      event.locals.session = session;
    },
  ],
  onBeforeResponse: [
    (event) => {
      event.response.headers.set("X-Request-Id", crypto.randomUUID());
    },
  ],
});

// app.config.ts
import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  middleware: "./src/middleware.ts",
});
```

Middleware runs in order — place auth before logging if you need user context in logs.

Reference: [SolidStart Docs - createMiddleware](https://docs.solidjs.com/solid-start/reference/server/create-middleware)
