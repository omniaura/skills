---
name: solidjs-patterns
description: Write, review, and migrate Solid 2.0 RC applications using fine-grained reactivity, split effects, async memos, optimistic actions, draft stores, and TanStack Solid Query v6. Use for Solid components, state, data fetching, DOM interop, tests, or Solid 1-to-2 migration. Solid 2 only; use this repository's v2 skill for Solid 1.x.
license: MIT
metadata:
  author: omniaura
  version: "3.0.1"
---

# Solid 2 Patterns

Target **Solid 2.0 RC** (`solid-js` + `@solidjs/web` rc.18), Query **v6 RC** (`6.0.0-rc.5`), and `@solidjs/vite-plugin@3.0.0-next.51`. RC behavior is version-sensitive: check installed types and test meaningful examples when updating versions. This is an SPA-compatible skill, not a requirement to adopt SolidStart or SSR.

## Read only what the task needs

| Task                                                     | Reference                                  |
| -------------------------------------------------------- | ------------------------------------------ |
| Signals, deferred writes, split effects, lifecycle       | [rules/reactivity.md](rules/reactivity.md) |
| Async memos, Loading/Errored/Reveal, actions, optimism   | [rules/async.md](rules/async.md)           |
| Query cache, suspending reads, mutations, rollback       | [rules/query.md](rules/query.md)           |
| Draft stores, projections, context                       | [rules/state.md](rules/state.md)           |
| Props, lists, classes, dynamic components, ref factories | [rules/components.md](rules/components.md) |
| Compiler setup, test timing, migration verification      | [rules/testing.md](rules/testing.md)       |

Full generated reference: [AGENTS.md](AGENTS.md).

## Defaults that prevent most bugs

1. Keep reactive reads in JSX/memos; derive values instead of writing them back. No signal writes in component/memo/compute scope.
2. Setters are deferred and automatically batched. Carry local values forward; `flush()` only at explicit imperative boundaries/tests.
3. Effects are `createEffect(compute, apply)`. Compute reads; apply performs side effects and **returns cleanup**. No `onCleanup` inside apply.
4. Use `onSettled(() => { ... })`, with braces. Callback returns cleanup or nothing, never a setter value/promise.
5. Async memo reads belong under local `Loading`/`Errored` boundaries. Keep stale content during updates; do not hide the whole app for refetches.
6. Ref callbacks are unowned. Register cleanup in component setup or an owned ref factory, not inside the element callback.
7. Stores use draft setters; props use `merge`/`omit`; context itself is the provider. Native classes use arrays/objects.
8. Keep Query for shared cache/devtools/persistence needs, not merely to fetch one value. Query v6 `.data` suspends: guard disabled/no-cache queries by status.
9. Query `mutate` returns a promise. No `mutateAsync`, per-call callbacks, or old `onMutate` rollback context. Shared cache optimism needs write → `flush()` → mutate; await invalidation in `onSuccess`.
10. Test with the Solid 2 compiler and real runtime. Typechecking alone misses owned-write, cleanup, suspension, and transition behavior.

## Solid 1 migration checklist

Run the migration assistant, then verify Markdown examples and runtime semantics manually. Remove obsolete `batch`, `on`, `produce`, `onMount`, resource tuple patterns, and namespace directives; do not recreate them as compatibility wrappers. Update imports/types/compiler before debugging behavior. Read each relevant reference above for replacement semantics, not just renamed APIs.
