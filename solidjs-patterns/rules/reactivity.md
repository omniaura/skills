# Reactivity and lifecycle

**Impact: CRITICAL**

Components run once; reactive reads belong in JSX, memos, or the compute half of an effect. Keep props and store reads lazy: use `props.name` or `() => props.name`, not a destructured snapshot. Use `untrack` only for intentionally one-time reads.

## Derive; do not write back

Compute derived values with `createMemo`, not effects that synchronize signals. Writes in component bodies, memos, and effect compute functions throw `REACTIVE_WRITE_IN_OWNED_SCOPE`. Event handlers, effect apply functions, timers, and `onSettled` are write locations. Draft mutations in a store's derive function are allowed; unrelated signal writes are not.

```tsx
import { createMemo, createSignal } from "solid-js";

export function Counter() {
  const [count, setCount] = createSignal(0);
  const doubled = createMemo(() => count() * 2);
  return (
    <button
      onClick={() => {
        setCount((n) => n + 1);
      }}
    >
      {doubled()}
    </button>
  );
}
```

## Setters are deferred

Updates batch automatically until the microtask flush. A read immediately after a setter sees the old value. Prefer carrying the local value into imperative work; use `flush()` sparingly at imperative integration boundaries or in tests. Do not add `batch` wrappers.

```ts
import { createSignal, flush } from "solid-js";

export function deferredRead() {
  const [count, setCount] = createSignal(0);
  setCount(1);
  const before = count(); // 0
  flush();
  return { before, after: count() }; // after: 1
}
```

## Split effects; return cleanup

`createEffect(compute, apply)` tracks only compute. Compute must be pure; apply is untracked and may perform side effects. Return cleanup from apply: `onCleanup` inside apply silently does not register. Use `createRenderEffect(compute, apply)` only for necessary pre-paint DOM work. Compute runs **immediately** when the effect is created (apply is queued), so register effects after the declarations their compute reads — an effect above a later `const` hits a temporal-dead-zone error.

```ts
import { createEffect, type Accessor } from "solid-js";

export function subscribeRoom(room: Accessor<string>, connect: (id: string) => () => void) {
  createEffect(room, (id) => {
    const disconnect = connect(id);
    return disconnect;
  });
}
```

For multiple dependencies, return an object/tuple from compute. To skip the first apply, use a local first-run boolean; testing `previous === undefined` is ambiguous if `undefined` is a valid dependency. Previous-value seeds belong in default parameters, not an old positional initial-value argument.

## Setup after settling

Use `onSettled`, with a block body. Its callback may return cleanup or `undefined`, never a setter result, promise, or arbitrary value. `onCleanup` remains valid in owned component/root/directive setup.

```tsx
import { onSettled } from "solid-js";

export function FocusInput() {
  let input!: HTMLInputElement;
  onSettled(() => {
    input.focus();
  });
  return <input ref={input} aria-label="Name" />;
}
```

Nested `createRoot` scopes now dispose with their parent. Use `runWithOwner(null, () => createRoot(...))` only when a truly detached lifetime is intentional, and retain/dispose the root explicitly.
