---
title: Use LazyShow Pattern for Conditionally-Rendered Heavy Components
impact: MEDIUM
impactDescription: prevents Suspense layout flicker for modals and conditional UI
tags: performance, lazy, suspense, show, modal
---

## Use LazyShow Pattern for Conditionally-Rendered Heavy Components

**Impact: MEDIUM (prevents Suspense layout flicker for modals and conditional UI)**

When lazy-loading components that are conditionally rendered (modals, drawers, tabs), place `<Suspense>` inside `<Show>` — not the other way around. Wrapping `<Show>` with `<Suspense>` causes the fallback to flash every time the condition toggles, even when the component is already loaded.

**Incorrect (Suspense wrapping Show — flicker on toggle):**

```tsx
const HeavyModal = lazy(() => import("./HeavyModal"))

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Show when={isOpen()}>
        <HeavyModal />  {/* ❌ Suspense boundary causes flicker */}
      </Show>
    </Suspense>
  )
}
```

**Correct (Show wrapping Suspense — LazyShow pattern):**

```tsx
// Reusable LazyShow component
interface LazyShowProps<T> {
  when: T | undefined | null | false
  fallback?: JSX.Element
  children: (value: NonNullable<T>) => JSX.Element
}

function LazyShow<T>(props: LazyShowProps<T>) {
  return (
    <Show when={props.when}>
      {(value) => (
        <Suspense fallback={props.fallback}>
          {props.children(value())}
        </Suspense>
      )}
    </Show>
  )
}

// Usage
const HeavyModal = lazy(() => import("./HeavyModal"))

function App() {
  return (
    <LazyShow when={isOpen()} fallback={<ModalSkeleton />}>
      {() => <HeavyModal onClose={close} />}
    </LazyShow>
  )
}
```

**When to use LazyShow:**
- Modals and dialogs with heavy content
- Tab panels with lazy-loaded content
- Drawer/sidebar with complex forms
- Any `<Show>` + `lazy()` combination

Reference: [SolidJS Suspense](https://docs.solidjs.com/reference/components/suspense)
