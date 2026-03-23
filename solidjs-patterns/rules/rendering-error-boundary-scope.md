---
title: ErrorBoundary Only Catches Rendering and Reactive Errors
impact: MEDIUM
impactDescription: event handler errors silently escape — users see no fallback UI
tags: rendering, error-boundary, error-handling, events
---

## ErrorBoundary Only Catches Rendering and Reactive Errors

**Impact: MEDIUM (event handler errors silently escape — users see no fallback UI)**

`<ErrorBoundary>` catches errors thrown during rendering and inside reactive computations (effects, memos). It does NOT catch errors from event handlers, `setTimeout`, `requestAnimationFrame`, or promise rejections — those bypass the boundary entirely.

**Incorrect (assuming ErrorBoundary catches everything):**

```tsx
<ErrorBoundary fallback={(err) => <p>Error: {err.message}</p>}>
  <button onClick={() => {
    // ❌ This error escapes the boundary — no fallback shown
    throw new Error("Button handler failed");
  }}>
    Click me
  </button>
</ErrorBoundary>
```

**Correct (manually catch event handler errors):**

```tsx
function SafeButton() {
  const [error, setError] = createSignal<Error | null>(null);

  return (
    <Show when={!error()} fallback={<p>Error: {error()!.message}</p>}>
      <button onClick={() => {
        try {
          riskyOperation();
        } catch (err) {
          setError(err as Error);
        }
      }}>
        Click me
      </button>
    </Show>
  );
}
```

**What ErrorBoundary DOES catch:**

```tsx
<ErrorBoundary fallback={(err) => <p>{err.message}</p>}>
  {/* ✅ Rendering errors */}
  <ComponentThatThrowsDuringRender />

  {/* ✅ Errors in effects/memos */}
  <ComponentWithFailingEffect />

  {/* ✅ Errors from createResource/createAsync (network failures) */}
  <Suspense fallback={<Loading />}>
    <AsyncComponent />
  </Suspense>
</ErrorBoundary>
```

**Tip:** For comprehensive error handling, combine `<ErrorBoundary>` for rendering errors with try/catch in event handlers and `.catch()` on promises.

Reference: [SolidJS Docs - ErrorBoundary](https://docs.solidjs.com/reference/components/error-boundary)
