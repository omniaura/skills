---
title: Validate All Inputs Inside "use server" Functions
impact: HIGH
impactDescription: server functions are public HTTP endpoints — unvalidated input leads to injection/data leaks
tags: solidstart, security, validation, use-server, zod
---

## Validate All Inputs Inside "use server" Functions

**Impact: HIGH (server functions are public HTTP endpoints — unvalidated input leads to injection/data leaks)**

Every `"use server"` function compiles to a public HTTP POST endpoint. TypeScript types are erased at runtime — an attacker can send any payload. Always validate inputs with a runtime schema (Zod), check auth inside each function, and never return raw internal errors.

**Incorrect (trusting TypeScript types at runtime):**

```typescript
async function updateProfile(userId: string, data: ProfileData) {
  "use server";
  // ❌ No input validation — attacker can send { role: "admin" }
  // ❌ No auth check — anyone can update any profile
  await db.users.update({ where: { id: userId }, data });
}
```

**Correct (validate inputs + check auth):**

```typescript
import { z } from "zod";
import { getSession } from "./auth";

const ProfileSchema = z.object({
  displayName: z.string().min(1).max(100),
  bio: z.string().max(500).optional(),
});

async function updateProfile(userId: string, rawData: unknown) {
  "use server";

  // 1. Auth check
  const session = await getSession();
  if (!session || session.userId !== userId) {
    throw new Error("Unauthorized");
  }

  // 2. Runtime validation
  const result = ProfileSchema.safeParse(rawData);
  if (!result.success) {
    throw new Error("Invalid input");
  }

  // 3. Use validated data only
  await db.users.update({
    where: { id: userId },
    data: result.data,
  });
}
```

**Security checklist for server functions:**
- Validate all inputs with Zod `safeParse` (not just `parse` — catch errors gracefully)
- Check authentication AND authorization inside each function
- Never return raw database errors or stack traces
- Treat `"use server"` as a trust boundary — same rigor as a REST endpoint

Reference: [SolidStart - "use server"](https://docs.solidjs.com/solid-start/reference/server/use-server)
