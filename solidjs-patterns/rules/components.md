# Components, DOM, and control flow

**Impact: HIGH**

## Imports, props, and dynamic components

Core primitives and stores come from `solid-js`. Browser rendering (`render`, `Portal`, `dynamic`) and DOM types (`JSX`, `ComponentProps`) come from `@solidjs/web`. Renderer-neutral `Element` comes from `solid-js`. Set TypeScript `jsx: "preserve"`, `jsxImportSource: "@solidjs/web"`, and use `@solidjs/vite-plugin` for compilation.

Use `merge(defaults, props)` for reactive defaults, but remember explicit `undefined` **overrides** defaults. Use `omit(props, ...keys)` to forward remaining props and read picked props directly from `props`. Do not destructure reactive props or eagerly copy them with object spread. Resolve children once with `children(() => props.children)` only if inspecting/transforming them; otherwise render `props.children` directly.

```tsx
import { merge, omit } from "solid-js";
import { dynamic, type JSX } from "@solidjs/web";

export function Button(input: JSX.ButtonHTMLAttributes<HTMLButtonElement>) {
  const props = merge({ type: "button" as const }, input);
  const rest = omit(props, "class", "children", "type");
  return (
    <button {...rest} type={props.type ?? "button"} class={["button", props.class]}>
      {props.children}
    </button>
  );
}

export function Slot(props: {
  component: (props: { label: string }) => JSX.Element;
  label: string;
}) {
  const Content = dynamic(() => props.component);
  return <Content label={props.label} />;
}
```

Hoist `dynamic` creation into component setup; do not create it inside a reactive JSX expression. Prefer this factory to deprecated `Dynamic`/`createDynamic` patterns.

## Keying defines identity

Choose deliberately; changing modes changes state preservation:

- `<For each={rows()}>`: item is a raw value, index is an accessor; identity follows the item reference.
- `<For each={rows()} keyed={false}>`: item is an accessor, index a number; identity follows the slot (replaces `Index`).
- `<For each={rows()} keyed={row => row.id}>`: both item and index are accessors; identity follows the returned key even when fetched objects are replaced.
- `<Repeat count={count()}>`: callback receives a numeric index; use for a count, not object identity.

```tsx
import { For, Repeat, Show } from "solid-js";

export function Rows(props: { rows: { id: string; name: string }[]; selected?: string }) {
  return (
    <>
      <For each={props.rows} keyed={(row) => row.id}>
        {(row, index) => (
          <p>
            {index() + 1}: {row().name}
          </p>
        )}
      </For>
      <For each={props.rows} keyed={false}>
        {(row, index) => <input aria-label={`Slot ${index}`} value={row().name} />}
      </For>
      <Repeat count={3}>{(index) => <span>{index}</span>}</Repeat>
      <Show when={props.selected}>{(selected) => <b>{selected()}</b>}</Show>
    </>
  );
}
```

`Show` and `Match` function children receive accessors by default; `Show keyed` receives the raw value and remounts on identity change. Do not read an accessor as if it were an object. Use `For` for stable list instances; `.map` is not an identity-preserving rendering primitive.

## Class arrays and event casing

Native elements accept class strings, arrays, and objects: `class={["base", props.class, { active: selected() }]}`. Native `classList` is gone. Use camelCase event props (`onClick`, `onInput`); lowercase `onclick` becomes an attribute. `on:`, `oncapture:`, `attr:`, `bool:`, and `use:` namespaces are gone. For native listener options, use a ref factory with explicit cleanup. Booleans use presence/absence rules.

## Ref callbacks are unowned; factories own setup

`ref={element => ...}` callbacks have no owner. Registering `onCleanup` there silently leaks listeners. For component setup, capture a ref then use `onSettled` with returned cleanup. For reusable directives, call an owned factory during setup that registers cleanup and returns the unowned element callback. Multiple refs use arrays.

```tsx
import { onCleanup, onSettled } from "solid-js";

export function listenClick(handler: (event: MouseEvent) => void) {
  let element: HTMLButtonElement | undefined;
  onCleanup(() => {
    element?.removeEventListener("click", handler, true);
  });
  return (next: HTMLButtonElement) => {
    element?.removeEventListener("click", handler, true);
    element = next;
    element.addEventListener("click", handler, true);
  };
}

export function NativeButton(props: { onPress: () => void }) {
  let button!: HTMLButtonElement;
  const click = listenClick(() => {
    props.onPress();
  });
  onSettled(() => {
    button.focus();
  });
  return (
    <button
      ref={[
        (element) => {
          button = element;
        },
        click,
      ]}
    >
      Press
    </button>
  );
}
```

## Preserve accessibility and component lifetime

Keep reactive conditions in JSX (`Show`/`Switch` or expressions), not an early return in component setup that freezes a branch. Use native buttons/links with accessible names, label form controls, preserve keyboard focus when panels update, and announce asynchronous status with a restrained `aria-live="polite"` region. Dialogs need focus containment, Escape dismissal, and focus restoration; prefer a Solid 2-compatible accessible primitive over hand-rolling it. These requirements do not disappear with the reactivity upgrade.

Keep third-party editor/chart/observer setup in `onSettled`, return its destroy/disconnect function, and feed updates through split effects rather than remounting the library. Use `lazy` plus a local `Loading` boundary for expensive routes/panels; preserve the SPA shell while code/data load.
