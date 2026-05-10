---
title: Snapshot Signal Values Before await When Stability Matters
impact: HIGH
impactDescription: "async handlers act on stale or unintended state after the UI changes"
tags: signals, async, event handlers, snapshots, stale state
---

## Snapshot Signal Values Before await When Stability Matters

**Impact: HIGH (async handlers act on stale or unintended state after the UI changes)**

Signals always return the current value. In async event handlers, that is often what you want. But when an operation must act on the value selected when the user clicked, snapshot the signal before the first `await` and pass stable primitives into the async work.

**Incorrect (reads the current signal after async work):**

```typescript
async function approvePermission() {
  if (!activePermission()) return;

  await auditPermissionAttempt();

  // activePermission() may now be a different request.
  await respondPermission(activePermission()!.id, "allow");
}
```

**Correct (snapshot the request before awaiting):**

```typescript
async function approvePermission() {
  const request = activePermission();
  if (!request) return;

  const requestId = request.id;
  await auditPermissionAttempt();
  await respondPermission(requestId, "allow");
}
```

**Correct (read after await only when latest state is intended):**

```typescript
async function refreshIfStillVisible() {
  await refetch();

  if (panelOpen()) {
    focusResults();
  }
}
```

**Notes:**

- Snapshot IDs, indexes, form values, and selected records before `await` when the operation belongs to that starting state
- Re-read signals after `await` only when the code explicitly wants the latest state
- Prefer passing the snapshot into helper functions instead of letting helpers call UI signals internally

Reference: [SolidJS signals](https://docs.solidjs.com/concepts/signals)
