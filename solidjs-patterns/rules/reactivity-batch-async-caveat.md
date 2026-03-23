---
title: batch() Only Batches Synchronous Updates
impact: MEDIUM
impactDescription: updates after await bypass batching — unexpected intermediate renders
tags: reactivity, batch, async, performance
---

## batch() Only Batches Synchronous Updates

**Impact: MEDIUM (updates after await bypass batching — unexpected intermediate renders)**

`batch()` defers subscriber notifications until the callback completes, but only for synchronous code. If the callback is async, updates after the first `await` are applied immediately and individually — defeating the purpose of batching.

**Incorrect (async batch — updates after await are NOT batched):**

```tsx
batch(async () => {
  setName("Alice");       // ✅ batched
  setAge(30);             // ✅ batched
  const data = await fetchProfile();
  setEmail(data.email);   // ❌ applied immediately (not batched)
  setAvatar(data.avatar); // ❌ applied immediately (separate update)
});
```

**Correct (batch only synchronous updates):**

```tsx
// Option 1: Fetch first, batch the sync updates
const data = await fetchProfile();
batch(() => {
  setName(data.name);
  setAge(data.age);
  setEmail(data.email);
  setAvatar(data.avatar);
});

// Option 2: Use a store with reconcile (single update)
const [profile, setProfile] = createStore(initialProfile);
const data = await fetchProfile();
setProfile(reconcile(data));
```

**Also note:** Reading a signal inside `batch()` after setting it returns the OLD value (pre-batch), since updates are deferred:

```tsx
batch(() => {
  setCount(5);
  console.log(count()); // Still the old value, not 5
});
// After batch completes, count() returns 5
```

Reference: [SolidJS Docs - batch](https://docs.solidjs.com/reference/reactive-utilities/batch)
