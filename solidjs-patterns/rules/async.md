# Async data and actions

**Impact: CRITICAL**

## Async memos and local boundaries

An async memo replaces the resource tuple. Capture reactive inputs synchronously before awaiting; reads after `await` do not establish dependencies. Place every potentially not-ready read under a purposeful `<Loading>` boundary: without one, initial suspension can blank the render root, including navigation and other chrome.

```tsx
import { createMemo, Errored, isPending, Loading, refresh } from "solid-js";

export function Profile(props: { id: string; load: (id: string) => Promise<string> }) {
  const name = createMemo(() => props.load(props.id));
  return (
    <section>
      <button
        onClick={() => {
          void refresh(name).catch(() => {
            /* Errored displays the failure. */
          });
        }}
      >
        Refresh
      </button>
      <Errored
        fallback={(error, reset) => <button onClick={reset}>Retry: {String(error())}</button>}
      >
        <Loading fallback={<p>Loading profile…</p>}>
          <p>{name()}</p>
          <small>{isPending(() => name()) ? "Updating…" : ""}</small>
        </Loading>
      </Errored>
    </section>
  );
}
```

`Loading` shows the first-load fallback and retains stale content during subsequent pending changes. Do not hide useful content behind manual refetch spinners. `isPending(() => value())` observes pending changes for that expression; a bare `refresh(value)` is a quiet re-ask, not a pending declaration. Use `affects(value)` inside an action when that work must declare affected data. Handle a rejected refresh promise if using it outside an error boundary/action.

`latest(accessor)` peeks at an in-flight value rather than the consistent displayed value; reserve it for intentional display-ahead affordances. Do not use it everywhere to bypass consistency. `refresh(target)` recomputes a memo/derived store/projection and returns a promise for settlement.

Use `<Reveal order="together">` to reveal sibling `Loading` slots together; default `order="sequential"` reveals in order. `order="natural"` lets a released nested group resolve independently. `collapsed` only applies to sequential reveal. Keep each slot's boundary close to its data, not around the whole application shell.

## Actions with optimistic state

`action` wraps a generator (or async generator), not an arbitrary async callback. `yield` async work so the transition includes it. Optimistic writes paint during the action and revert when it settles; derive the optimistic view from authoritative data and refresh that data after the server write. A plain optimistic value is not permanent persistence.

```tsx
import { action, createMemo, createOptimistic, refresh } from "solid-js";

export function createRenameModel(api: {
  read: () => Promise<string>;
  save: (name: string) => Promise<void>;
}) {
  const saved = createMemo(() => api.read());
  const [name, setName] = createOptimistic(() => saved());
  const rename = action(function* (next: string) {
    setName(next);
    yield api.save(next);
    yield refresh(saved);
  });
  return { name, rename };
}
```

For collections use `createOptimisticStore(() => authoritativeRows, [])`, then draft writes inside the action, followed by refresh of the authoritative source. The returned tuple mirrors `createStore`. Handle mutation failures at the event boundary; the optimistic overlay rolls back, but user-facing errors still need presentation.

## Choose the data layer deliberately

For an isolated read, an async memo plus `Loading` is enough. Keep TanStack Query when the application depends on shared keyed caching, deduplication, invalidation, pagination, persistence, or its devtools. Solid 2 handles async rendering consistency; it does not automatically supply a QueryClient cache or those tools. Do not remove a working cache solely to remove resource boilerplate. For Query v6 recipes, read [query.md](query.md).

These patterns work in an SPA. They do not require SolidStart, SSR, server functions, or a routing migration. Do not carry SolidStart 1.x `query`/`createAsync` recipes into Solid 2 without checking that integration's current API.
