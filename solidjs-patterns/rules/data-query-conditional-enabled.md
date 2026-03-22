---
title: Use enabled Option for Conditional Queries
impact: HIGH
impactDescription: prevents unnecessary network requests and runtime errors from missing dependencies
tags: solid-query, conditional, data-fetching
---

## Use enabled Option for Conditional Queries

**Impact: HIGH (prevents unnecessary network requests and runtime errors from missing dependencies)**

Solid Query's `enabled` option controls when a query should execute. Use it with signal-derived booleans to defer fetching until prerequisite data is available. Without it, queries fire immediately — even when required parameters are undefined.

**Incorrect (query fires before dependency is ready):**

```tsx
const messages = createQuery(() => ({
  queryKey: ["messages", props.conversationId()],
  queryFn: () => fetchMessages(props.conversationId()),
  // Fires immediately, even when conversationId is undefined
}));
```

**Correct (query deferred until dependency exists):**

```tsx
const messages = createQuery(() => ({
  queryKey: ["messages", props.conversationId()],
  queryFn: () => fetchMessages(props.conversationId()!),
  enabled: !!props.conversationId(),
}));
```

**Correct (multiple conditions):**

```tsx
const analytics = createQuery(() => ({
  queryKey: ["analytics", userId(), dateRange()],
  queryFn: () => fetchAnalytics(userId()!, dateRange()!),
  enabled: !!userId() && !!dateRange(),
}));
```

The `enabled` option is reactive — when the signal changes from falsy to truthy, the query automatically starts fetching. No manual `refetch()` needed.

Reference: [Solid Query - Disabling/Pausing Queries](https://tanstack.com/query/latest/docs/solid/guides/disabling-queries)
