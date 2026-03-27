---
title: Middleware Does NOT Run on Client-Side Navigations
impact: CRITICAL
impactDescription: auth bypass — users can navigate to protected routes without server-side checks
tags: solidstart, middleware, security, auth, client-navigation
---

## Middleware Does NOT Run on Client-Side Navigations

**Impact: CRITICAL (auth bypass — users can navigate to protected routes without server-side checks)**

SolidStart middleware (`onRequest`/`onBeforeResponse`) only runs on full-page server requests. Client-side navigations (via `<A>` links or `useNavigate`) skip middleware entirely. If you rely solely on middleware for auth, users with expired sessions can still navigate to protected routes.

**Incorrect (auth only in middleware — bypassed on client nav):**

```typescript
// src/middleware.ts
export default createMiddleware({
  onRequest: [
    (event) => {
      const session = getSessionFromCookie(event.request.headers);
      if (!session && isProtectedRoute(event.request.url)) {
        return Response.redirect("/login");
      }
      event.locals.session = session;
    },
  ],
});

// ❌ Server function trusts middleware did the auth check
const getProfile = query(async () => {
  "use server";
  const event = getRequestEvent()!;
  return db.users.find(event.locals.session.userId);  // No auth check here!
}, "profile");
```

**Correct (always validate at the data layer too):**

```typescript
// src/middleware.ts — first line of defense (server requests only)
export default createMiddleware({
  onRequest: [
    (event) => {
      const session = getSessionFromCookie(event.request.headers);
      if (!session && isProtectedRoute(event.request.url)) {
        return Response.redirect("/login");
      }
      event.locals.session = session;
    },
  ],
});

// ✅ Server function ALSO validates auth — covers client-side navigations
const getProfile = query(async () => {
  "use server";
  const event = getRequestEvent()!;
  const session = event.locals.session ?? getSessionFromCookie(
    event.request.headers
  );
  if (!session) throw redirect("/login");
  return db.users.find(session.userId);
}, "profile");
```

**Defense in depth:** Middleware is a convenience layer for server-rendered requests. Server functions are the true security boundary because they run on every data fetch, regardless of navigation type.

Reference: [SolidStart Middleware](https://docs.solidjs.com/solid-start/advanced/middleware)
