---
title: Never Use async/await Inside createEffect
impact: HIGH
impactDescription: signal reads after await silently lose tracking — effects never re-run
tags: reactivity, async, createEffect, tracking
---

## Never Use async/await Inside createEffect

**Impact: HIGH (signal reads after await silently lose tracking — effects never re-run)**

After the first `await` inside `createEffect`, the synchronous tracking context is destroyed. Any signal reads after `await` will NOT register as dependencies — the effect will never re-run when those signals change. This is one of the most common silent bugs in SolidJS.

**Incorrect (tracking lost after await):**

```tsx
createEffect(async () => {
  const id = userId();        // ✅ tracked (before await)
  const data = await fetchUser(id);
  const format = outputFormat(); // ❌ NOT tracked (after await)
  setDisplay(formatUser(data, format));
});
// Effect re-runs when userId changes, but NOT when outputFormat changes
```

**Correct (separate the async work from the tracking):**

```tsx
// Option 1: Track all signals before the await
createEffect(() => {
  const id = userId();
  const format = outputFormat(); // ✅ tracked (before await)
  fetchUser(id).then(data => {
    setDisplay(formatUser(data, format));
  });
});

// Option 2: Use createResource / createAsync for async data
const user = createAsync(() => fetchUser(userId()));
// Then derive from user() and outputFormat() in a memo or JSX
```

**Why this happens:** SolidJS tracks signal reads synchronously during function execution. `await` suspends execution and resumes in a microtask where the tracking scope no longer exists. This is fundamental to how JavaScript async works — not a SolidJS bug.

**Rule of thumb:** If you need `await` in an effect, restructure so ALL signal reads happen before the first `await`, or use `createResource`/`createAsync` instead.

Reference: [SolidJS Docs - createEffect](https://docs.solidjs.com/reference/basic-reactivity/create-effect)
