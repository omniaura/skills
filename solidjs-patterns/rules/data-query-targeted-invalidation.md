---
title: Use query.keyFor() for Targeted Cache Invalidation
impact: HIGH
impactDescription: all queries refetch after every action instead of only affected ones
tags: data-fetching, query, cache, invalidation, solid-router
---

## Use query.keyFor() for Targeted Cache Invalidation

**Impact: HIGH (all queries refetch after every action instead of only affected ones)**

By default, SolidStart revalidates ALL cached queries after any `action()` completes. For apps with many queries, this causes unnecessary network requests. Use `query.keyFor(args)` to invalidate only the affected cache entries.

**Incorrect (all queries refetch after mutation):**

```typescript
const getUser = query(async (id: string) => {
  "use server";
  return db.users.find(id);
}, "user");

const getPosts = query(async () => {
  "use server";
  return db.posts.list();
}, "posts");

const updateUser = action(async (data: FormData) => {
  "use server";
  const id = String(data.get("id"));
  await db.users.update(id, { name: String(data.get("name")) });
  // ❌ Default: ALL queries refetch (getUser AND getPosts)
  throw redirect(`/users/${id}`);
});
```

**Correct (only affected query refetches):**

```typescript
const updateUser = action(async (data: FormData) => {
  "use server";
  const id = String(data.get("id"));
  await db.users.update(id, { name: String(data.get("name")) });
  // ✅ Only the specific user query refetches — posts untouched
  throw redirect(`/users/${id}`, {
    revalidate: getUser.keyFor(id),
  });
});
```

**Multiple targeted invalidations:**

```typescript
throw redirect("/dashboard", {
  revalidate: [getUser.keyFor(id), getUserStats.keyFor(id)],
});
```

**Key points:**
- `query.keyFor(args)` returns the deterministic cache key for a specific set of arguments
- Without `revalidate`, ALL active queries refetch after any action — fine for simple apps, wasteful for complex ones
- Same key within 5 seconds reuses cached data; `revalidate` forces a fresh fetch

Reference: [SolidStart query](https://docs.solidjs.com/solid-router/reference/data-apis/query)
