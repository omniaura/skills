# Stores and context

**Impact: HIGH**

Use signals for scalar state and stores for nested objects/collections with per-property tracking. Store properties are plain values (`state.name`, not `state.name()`). Keep the proxy live; destructuring is a snapshot. Use `snapshot(store)` when an external library needs plain data.

## Draft-first setters and projections

No path setters or `produce` wrappers: mutate the provided draft. Use `reconcile(next, key)` on a draft collection to preserve item identity; the key is a string/function, not a Solid 1 options object. Prefer memos for simple derivations and `createProjection` for read-only derived collections with structural sharing. `createStore(fn, seed)` provides a derived store plus a setter when local writes are actually required.

```ts
import { createStore, createProjection, reconcile, snapshot } from "solid-js";

type Todo = { id: string; text: string; done: boolean };

export function createTodos() {
  const [state, setState] = createStore({ todos: [] as Todo[] });
  const summary = createProjection(
    (draft) => {
      draft.total = state.todos.length;
      draft.done = state.todos.filter((todo) => todo.done).length;
    },
    { total: 0, done: 0 },
  );
  function replace(rows: Todo[]) {
    setState((draft) => {
      reconcile(rows, "id")(draft.todos);
    });
  }
  function toggle(id: string) {
    setState((draft) => {
      const todo = draft.todos.find((row) => row.id === id);
      if (todo) todo.done = !todo.done;
    });
  }
  return { state, summary, replace, toggle, export: () => snapshot(state) };
}
```

Projection draft mutation is the derivation API, not permission to write into arbitrary external signals inside a compute scope. Do not synchronize a derived value back into the source with an effect.

## Context is the provider

Render `<Context value={...}>`, not `.Provider`. A default-less context throws when missing; `useContext` already returns `T`. An explicit `undefined` provider value also counts as missing. Use a `null` default only for genuinely optional context, not to silence a required-provider error. Instantiate app state inside its provider for independent roots/tests rather than sharing a module singleton by accident.

```tsx
import { createContext, createSignal, useContext, type Accessor } from "solid-js";
import type { JSX } from "@solidjs/web";

type Theme = { dark: Accessor<boolean>; toggle: () => void };
const ThemeContext = createContext<Theme>();

export function ThemeProvider(props: { children?: JSX.Element }) {
  const [dark, setDark] = createSignal(false);
  const value = {
    dark,
    toggle: () => {
      setDark((value) => !value);
    },
  };
  return <ThemeContext value={value}>{props.children}</ThemeContext>;
}
export function ThemeButton() {
  const theme = useContext(ThemeContext);
  return <button onClick={theme.toggle}>{theme.dark() ? "Dark" : "Light"}</button>;
}
```
