---
title: Don't Capture Signals During Handler Setup
impact: CRITICAL
impactDescription: causes stale closures and silent state bugs
tags: reactivity, closures, event-handlers
---

## Don't Capture Signals During Handler Setup

**Impact: CRITICAL (causes stale closures and silent state bugs)**

When signals are read during effect setup (not inside the returned callback), the value is captured once and becomes stale. Always read signals at execution time — inside the event handler or callback body itself.

**Incorrect (signal captured at setup time):**

```tsx
createEffect(() => {
  const currentPage = page(); // captured once when effect runs
  document.addEventListener("scroll", () => {
    console.log("Page:", currentPage); // always logs the initial value
  });
});
```

**Incorrect (signal read outside handler):**

```tsx
const [count, setCount] = createSignal(0);
const value = count(); // captured once at component setup
return <button onClick={() => alert(value)}>Show count</button>;
// Always alerts 0, even after setCount(5)
```

**Correct (read signal at execution time):**

```tsx
createEffect(() => {
  const handler = () => {
    console.log("Page:", page()); // read at scroll time — always current
  };
  document.addEventListener("scroll", handler);
  onCleanup(() => document.removeEventListener("scroll", handler));
});
```

**Correct (read signal inside handler):**

```tsx
const [count, setCount] = createSignal(0);
return <button onClick={() => alert(count())}>Show count</button>;
// Always alerts the current value
```

The key principle: signal getter calls (`signal()`) must happen at the moment you need the value, not ahead of time.

Reference: [SolidJS Docs - Reactivity](https://docs.solidjs.com/concepts/intro-to-reactivity)
