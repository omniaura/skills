# TanStack Solid Query v6

**Impact: CRITICAL**

Target `@tanstack/solid-query@6.0.0-rc.5` (and matching devtools). Continue using `useQuery(() => options)`, `useMutation`, `useInfiniteQuery`, `QueryClientProvider`, and `useQueryClient`. Keep keys reactive and include every fetch input in the key; pass cancellation signals to fetchers. Keep the QueryClient stable for the app lifetime.

## A data read can suspend

`query.data` suspends when no data is ready; put normal consumers under `Loading` and errors under `Errored`. On invalidation/refetch, keep cached content visible; use `isFetching` for a subtle indicator, not an early return that hides the content. Solid already retains previous values; do not mechanically port `keepPreviousData`. Function placeholders no longer receive previous-data arguments.

For object and array results, `query.data` is a reconciled store proxy whose identity stays stable across refetches **and query-key changes**. Identity checks (`data === lastData`) never observe a change: compare the query key/owner id or `snapshot(query.data)` content, and `snapshot()` anything you retain as "the previous data".

**Trap:** a disabled query with no cache can suspend indefinitely. `query.data ?? fallback` does not guard it: the read suspends before `??`. Status reads (`isPending`, `isSuccess`, `status`, `error`) do not suspend. In 6.0.0-rc.5, `isFetching` (and therefore `isLoading`, which is `isPending && isFetching`) reads the data node's pending state and **can** suspend a disabled, empty query; guard with `isPending`/`isSuccess` first and reserve `isFetching` for enabled queries or reads under `Loading`. Guard optional/disabled queries by status before reading data, or provide meaningful initial/placeholder data.

```tsx
import { useQuery } from "@tanstack/solid-query";

export function OptionalName(props: {
  id?: string;
  load: (id: string, signal: AbortSignal) => Promise<string>;
}) {
  const query = useQuery(() => ({
    queryKey: ["name", props.id],
    enabled: props.id !== undefined,
    queryFn: ({ signal }) => props.load(props.id!, signal),
  }));
  return <p>{query.isSuccess ? query.data : "Select a person"}</p>;
}
```

For a local spinner, `<Show when={!query.isPending} fallback={...}>` can guard a data read. Do not put unguarded data reads in the shell outside its `Loading` boundary.

## Mutation API and atomic settlement

`mutate(variables)` returns a promise; `mutateAsync` and per-call callback options are gone. Use `await mutate(variables)` with try/catch for sequential event work. Configure shared callbacks in `useMutation(() => options)`. The old `onMutate` return-value rollback context is not available: do not return a snapshot and expect it as `onError`'s third argument.

Return/await invalidation from `onSuccess` to keep the mutation pending until fresh data arrives, allowing one atomic paint. Do not fire-and-forget that promise if freshness is part of success.

```ts
import { useMutation, useQueryClient } from "@tanstack/solid-query";

export function useRename(save: (name: string) => Promise<void>) {
  const client = useQueryClient();
  return useMutation(() => ({
    mutationFn: save,
    onSuccess: () => client.invalidateQueries({ queryKey: ["name"] }),
  }));
}
```

## Cache optimism must paint before the transition

In this RC, normal cache writes inside `onMutate`, or immediately before `mutate()` in the same unflushed tick, are held by the mutation transition. They do **not** paint optimistically. For shared cache optimism: cancel in-flight reads, capture a closure snapshot, write the cache, **flush**, then mutate; rollback on failure and invalidate for authoritative state. Local optimistic primitives can instead be written inside `onMutate` and are designed for transitions.

Overlapping mutations entangle: follow-up writes in `onSuccess`/`onError`/`onSettled` can wait for _other_ in-flight mutations to settle. For per-row pending/error/reconcile UI, set the row's pending state and `flush()` before `mutate`, and keep the row's follow-up logic in the async handler around `await mutate(vars)`.

```ts
import { flush } from "solid-js";
import { useMutation, useQueryClient } from "@tanstack/solid-query";

type Item = { id: string; text: string };

export function useAddItem(save: (item: Item) => Promise<Item>) {
  const client = useQueryClient();
  const queryKey = ["items"] as const;
  let committed = false;
  const mutation = useMutation(() => ({
    mutationFn: save,
    onSuccess: () => {
      committed = true;
      return client.invalidateQueries({ queryKey });
    },
  }));
  let inFlight = false;
  async function add(item: Item) {
    // Serialize this list writer: snapshot rollback must not erase a later add.
    if (inFlight) throw new Error("An add is already pending; retry after it settles");
    inFlight = true;
    committed = false;
    try {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData<Item[]>(queryKey);
      client.setQueryData<Item[]>(queryKey, (rows) => [...(rows ?? []), item]);
      flush();
      try {
        return await mutation.mutate(item);
      } catch (error) {
        // A refetch/callback failure after server success must not undo a committed write.
        if (!committed) {
          // undefined is not a cache update; restore an absent entry explicitly.
          if (previous === undefined) client.removeQueries({ queryKey, exact: true });
          else client.setQueryData(queryKey, previous);
        }
        await client.invalidateQueries({ queryKey });
        throw error;
      }
    } finally {
      inFlight = false;
    }
  }
  return { mutation, add };
}
```

The example rejects overlapping calls to this hook instance explicitly; callers must handle the busy error and offer retry. If other components write the same key concurrently, use an app-wide per-key coordinator or operation-specific rollback, not a whole-list snapshot that can clobber another writer. Treat a failure during awaited invalidation separately from a server rejection when the API may already have committed. Reuse an existing app helper rather than duplicating this machinery in each component.

Cache observer updates are deferred too. In tests, await the DOM with `waitFor`/`findBy*`; use `flush()` at the explicit optimistic pre-mutation boundary, not indiscriminately after every operation.
